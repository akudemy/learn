const fs = require('fs').promises;
const { readFileSync } = require('fs');
const path = require('path');
const yml = require('yaml');
const vm = require('vm')
const Benchmark = require('benchmark');
const chalk = require('chalk');

const readline = require('readline');

function getChallenges() {
  // in the future we can have multiple files, and check installed npm packages for added challenges
  const file = readFileSync(path.join(__dirname, './challenges.yml'), 'utf-8');
  const challenges = yml.parse(file);

  return challenges;
}
const challenges = getChallenges();

class Challenge {
  constructor (cid) {
    this.cid = cid;
    this.data = challenges[cid];

    if (!this.data) {
      throw new Error(`No challenge with id ${cid} found`);
    }
  }

  async run() {
    const challengePath = path.join(__dirname, 'challenge.js');
    await fs.writeFile(challengePath, this.data.template, 'utf8');

    this.startTime = Date.now();

    console.log(`Challenge "${chalk.bold(this.cid)}" started at ${new Date(this.startTime)}.`);
    console.log('');
    console.log('You can solve it by editing the file at');
    console.log(`  ${chalk.bold(challengePath)}`);
    console.log('');
    console.log('The recommended challenge duration is');
    console.log(`  ${chalk.bold(msToReadableDuration(this.data.recommended_time_ms))}`);
    console.log('so try to finish before');
    console.log(`  ${new Date(this.startTime + this.data.recommended_time_ms)}`);
    console.log('');
    console.log('You are allowed to write/run your own tests, referring to that file, or copy-paste the contents into another file');
    console.log('for editing. Just remember to paste them back and save the file before submitting!');
    console.log('')
    console.log('On this terminal, you can now press:')
    logRunningChallengeCommands();
    console.log('');

    while (true) {
      process.stdout.write('> ');
      const char = await readChar();

      switch (char) {
        case 'space':
          console.log('[space]');
          console.log(`Running tests after ${msToReadableDuration(Date.now() - this.startTime)}`)
          console.log(``);
          await this.test()
          break;
        case 'return':
          console.log('[enter]');
          await this.submit();
          process.exit(0);
        case 't': 
          console.log('t'); // skip past the `t` the user just pressed
          const elapsed = Date.now() - this.startTime;
          console.log(`${chalk.bold(msToReadableDuration(elapsed))} /${msToReadableDuration(this.data.recommended_time_ms)} (${Math.floor(elapsed/this.data.recommended_time_ms * 100)}%)`)
          break;
        case 'x':
        case 'c':
          console.log(char); // skip past `char`
          console.log(`Exiting after ${msToReadableDuration(Date.now() - this.startTime)}`);
          process.exit(0);
        default:
          console.log(char); // skip past char
          console.log(`Unknown command "${char}". Your options are:`)
          logRunningChallengeCommands();
      }
    }
  }

  async test(all=false) {
    const content = await fs.readFile('./challenge.js', 'utf-8');

    const results = {
      all,
      pass: true,
      suites: {},
      score: 0,
      maxScore: 0,
    };
    let fails = 0;

    for (const suiteName in this.data.tests) {
      const suite = this.data.tests[suiteName];

      if (Object.keys(suite).length === 0) {
        continue;
      }

      results.suites[suiteName] = {
        pass: true,
        tests: {},
        score: 0,
        maxScore: 0,
      };
      console.log(suiteName);

      for (const testName in suite) {
        const test = suite[testName];

        if (all || test.visible) {
          process.stdout.write(`  ${testName} ${chalk.dim(`(${test.args} => ${JSON.stringify(test.res)}) ... `)}`);

          const testResult = runTest(this.data.fn_name, test, content);

          results.suites[suiteName].tests[testName] = testResult;
          process.stdout.write(testResult.pass ? chalk.green('ok') : chalk.bold.red('fail'));
          if (testResult.time) {
            process.stdout.write(` [${testResult.time}ms ${chalk.dim(`/ ${test.max_time_ms}ms`)}]`);
          }
          console.log('')

          if (!testResult.pass) {
            results.suites[suiteName].pass = false;
            results.pass = false;
            fails++;

            if (test.max_time_ms && testResult.time > test.max_time_ms) {
              console.log(`    went over limit of ${chalk.bold(test.max_time_ms)}ms`);
            } else if (testResult.error) {
              console.log(`    received error while running: ${testResult.error}`);
            } else {
              console.log('    expected');
              process.stdout.write(`      ${JSON.stringify(test.res)}`);
              if (test.delta) {
                process.stdout.write(` ± ${(test.delta/2)}`)
              }
              console.log('');
              console.log('    but got');
              console.log(`      ${JSON.stringify(testResult.res)}`)
            }
          }

          // default to 1 if not specified
          const score = test.score || 1;
          results.maxScore += score;
          results.suites[suiteName].maxScore += score;
          if (testResult.pass) {
            results.score += score;
            results.suites[suiteName].score += score;
          }
        }
      }
    }

    if (fails > 0) {
      console.log();
      console.log(chalk.red(`You have ${chalk.bold(fails + ' failed')} tests`));
    } else {
      console.log();
      console.log(chalk.green(`All tests ${chalk.bold('passed')}!`));
    }

    this.testResults = results;
  }

  async submit() {
    const endTime = Date.now();
    const elapsed = endTime - this.startTime;
    const elapsedText = msToReadableDuration(elapsed);

    console.log(`Submitting challenge after ${elapsedText}.`);
    console.log(``);
    console.log(`Running tests...`);

    await this.test(true);

    console.log();

    const timePerc = Math.floor(elapsed/this.data.recommended_time_ms * 100);
    console.log(`You did it in ${(
      timePerc < 95 ? chalk.bold.green(elapsedText)
      : timePerc < 100 ? chalk.bold.yellow(elapsedText)
      : chalk.bold.red(elapsedText)
    )} out of ${chalk.bold(msToReadableDuration(this.data.recommended_time_ms))}: ${(
      timePerc < 95 ? chalk.bold.green('under the limit!')
      : timePerc < 100 ? chalk.bold.yellow('close to the limit!')
      : chalk.bold.red('over the limit :/')
    )}`);

    console.log();

    console.log('Suite scores:')
    for (const suiteName in this.testResults.suites) {
      const suite = this.testResults.suites[suiteName];
      const perc = suite.score / suite.maxScore * 100;
      const scoreText = `${Math.floor(perc)}% (${suite.score}/${suite.maxScore})`
      console.log(`  ${suiteName}: ${(
          perc > 70 ? chalk.bold.green(scoreText) 
        : perc > 60 ? chalk.bold.yellow(scoreText)
        : chalk.bold.red(scoreText)
      )}`);
    }
    console.log();
    const perc = this.testResults.score / this.testResults.maxScore * 100;
    const scoreText = `${Math.floor(perc)}% (${this.testResults.score}/${this.testResults.maxScore})`
    console.log(chalk.bold(`Total score: ${(
        perc > 70 ? chalk.green(scoreText) 
      : perc > 60 ? chalk.yellow(scoreText)
      : chalk.red(scoreText)
    )}`));
  }
}
function runTest(fnName, test, content) {
  try {
    const testResult = vm.runInNewContext(content + `;
      /* test runner */ ${fnName}(${test.args})`);

    const result = {
      pass: false,
      res: testResult,
    }

    if (JSON.stringify(testResult) == test.res) {
      result.pass = true;
    } else if (typeof test.res === 'number' && test.delta) {
      // test.res within delta/2 of testResult
      if (testResult >= test.res - test.delta/2 && testResult <= test.res + test.delta/2) {
        result.pass = true;
      }
    }

    if (result.pass && test.max_time_ms) {
      // `maxTime: 0.5` limits maximum amount of time a benchmark runs to 0.5s, compared to default 5s
      const benchRes = vm.runInNewContext(content + `;
        /* benchmark runner */ new Benchmark({maxTime: 0.5}, () => ${fnName}(${test.args})).run()`,
        { Benchmark });

      // `stats.mean` is s, but `ms` are more manageable
      result.time = benchRes.stats.mean * 1000;

      if (test.max_time_ms && result.time > test.max_time_ms) {
        result.pass = false;
        result.validityPass = true;
      }
    }

    return result;
  } catch (e) {
    return {
      pass: false,
      error: {
        message: e.message,
        stack: e.stack,
      },
    }
  }
}

function logRunningChallengeCommands() {
  console.log('  [space] to run available tests');
  console.log('  [enter] to simulate submitting the challenge. This runs more tests and summarizes your scores');
  console.log('  [t] to see time elapsed');
  console.log('  [x] or [c] to exit');
}

function validateChallengeById(cid) {
  let errors = 0;
  let warnings = 0;

  const error = (str) => {
    if (errors === 0 && warnings === 0) {
      // go on a newline from the `...`
      console.log();
    }
    errors++;
    console.log('  ' + chalk.red.bold(str));
  }
  const warn = (str) => {
    if (errors === 0 && warnings === 0) {
      // go on a newline from the `...`
      console.log();
    }
    warnings++;
    console.log('  ' + chalk.yellow.bold(str));
  }
  process.stdout.write(`validating ${cid} ... `)
  try {
    const challenge = challenges[cid];

    if (!challenge.fn_name) {
      error('no `fn_name`');
    }
    if (!challenge.template) {
      error('no `template`')
    }
    if (!challenge.sample_solution) {
      warn('no `sample_solution`')
    }
    if (!challenge.recommended_time_ms) {
      warn('no `recommended_time_ms`')
    }
    if (!challenge.tests) {
      error('no `tests`');
    }
    Object.keys(challenge).forEach((key) => {
      if (![
        'fn_name',
        'template',
        'sample_solution',
        'recommended_time_ms',
        'tests',
        'source',
        'tags',
        'difficulty',
      ].includes(key)) {
        warn(`unknown key ${key}`)
      }
    })
    if (errors + warnings > 0) {
      // add a separator
      console.log();
    }

    if (!challenge.tests.correctness) {
      warn('no suite named `correctness`');
    }
    if (!challenge.tests.edge_cases) {
      warn('no suite named `edge_cases`');
    }
    if (!challenge.tests.performance) {
      warn('no suite named `performance`');
    }

    for (const suiteName in challenge.tests) {
      const suite = challenge.tests[suiteName];
      for (const testName in suite) {
        const test = suite[testName];

        if (test.args === undefined) {
          warn(`${suiteName}>${testName} lacks 'args'. Set to empty string if no args required`);
        }
        if (test.res === undefined) {
          error(`${suiteName}>${testName} lacks 'res'`);
        }
        if (suiteName === 'performance' && !test.max_time_ms) {
          warn(`${suiteName}>${testName} lacks a 'max_time_ms'. Set to '!!float Infinity' to disable warning`);
        }
        if (typeof test.res === 'number' && (test.res % 1 !== 0) && test.delta === undefined) {
          warn(`${suiteName}>${testName} has a floating point 'res' but lacks a delta. Set to '0' to disable warning`)
        }
        Object.keys(test).forEach((key) => {
          if (![
            'visible',
            'args',
            'res',
            'delta',
            'max_time_ms',
            'score',
          ].includes(key)) {
            warn(`${suiteName}>${testName} unknown key ${key}`)
          }
        })

        const res = runTest(challenge.fn_name, test, challenge.sample_solution);
        if (!res.pass) {
          error(`${suiteName} > ${testName} failed:\n    got: ${
            indent(JSON.stringify(res, null, ' '), '    ', true)
          }\n    test: ${
            indent(JSON.stringify(test, null, ' '), '    ', true)
          }`);
        }
      }
    }
  } catch (e) {
    error(`problem occured while trying to verify ${cid}: ${e}`)
  }

  if (errors > 0) {
    console.log();
    error(`failed with ${errors} errors`);
  } else if (warnings > 0) {
    console.log();
    warn(`found ${warnings} warnings`);
  } else {
    console.log(chalk.green('ok'));
  }

  return errors > 0;
}

class CharReader {
  constructor() {
    this.promises = [];

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (_str, key) => {
      if (this.promises.length > 0) {
        this.promises.shift().resolve(key.name)
      }
    })
  }
  static get() {
    if (!CharReader.instance) {
      CharReader.instance = new CharReader();
    }

    return CharReader.instance;
  }
  static read() {
    return this.get().read();
  }
  read() {
    const deferredPromise = {};
    const promise = new Promise((resolve, reject) => {
      deferredPromise.resolve = resolve;
      deferredPromise.reject = reject;
    })
    this.promises.push(deferredPromise)

    return promise;
  }
}
function readChar() {
  return CharReader.read();
}

function msToReadableDuration(ms, isChildCall=false) {
  const SECOND = 1_000;
  const MINUTE = SECOND * 60;
  const HOUR = MINUTE * 60;
  const spacing = isChildCall ? ' ' : '';

  if (ms >= HOUR) {
    return spacing + Math.floor(ms / HOUR) + 'h' + msToReadableDuration(ms % HOUR, true);
  }
  if (ms >= MINUTE) {
    return spacing + Math.floor(ms / MINUTE) + 'min' + msToReadableDuration(ms % MINUTE, true);
  }
  if (ms >= SECOND) {
    return spacing + Math.floor(ms / SECOND) + 's';
  }
  // ignore sub-second differences unless only difference
  if (!isChildCall) {
    return ms + 'ms';
  }
  return '';
}
function indent(text, indentation, ignoreFirstLine=false) {
  return text.split('\n').map((line, i) => {
    if (i === 0 && ignoreFirstLine) {
      return line;
    }
    return indentation + line;
  }).join('\n');
}

module.exports = {
  challenges,
  Challenge,
  validateChallengeById,
}
