# Learn
CLI for managing step-4 challenges.

This program runs predefined challenges on your machine, and is not intended to stop you from cheating, as it
is a learning tool.

## Usage
Run `./bin/learn` to see available commands.

You can run `./bin/learn add` for a sample challenge.

To review your progress and run some data analysis on yourself after completing several challenges, you can have
a look at the generated `history.yml` file, containing your scores.

## Contributing
To add challenges, add a PR modifying `challenges.yml`. Make sure `./bin/learn --validate <your challenge id>`
has no errors/warnings before making the PR.

To fix bugs or add functionality, make a PR. The bulk of the logic is in `index.js`

## TODO
- infinite loop/timeout checker
- get challenges from other packages
- add ability to run multiple challenges at once, so the user can switch through them at the pace they desire,
  within the same time limit
- make `learn` executable more easily reachable
