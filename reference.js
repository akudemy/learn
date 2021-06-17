/**
 * Challenge Reference Sheet
 *
 * A lot of challenges follow similar patterns and deal with similar problems.
 * Sometimes these assume terminology and formulae that participants might not
 * be familiar with.
 *
 * This sheet tries to mitigate that by providing searchable definitions.
 *
 * To aid searchability, names are defined in `snake_case` so you only ever
 * have to search in lowercase.
 *
 * Legend:
 *   `//=` marks a section
 *   `///` marks a subsection
 *   `fast_` indicates a more performant version
 */

//=============//
// Definitions //
//=============//

//====================//
// Common Subproblems //
//====================//

/// Trigonometry
const degree_to_radian = degree => degree/180 * Math.PI
const radian_to_degree = radian => radian/Math.PI * 180
const chartesian_to_polar = ({ x, y }) => ({
  radian: Math.atan2(y, x), // -pi to +pi
  radius: Math.hypot(x, y), // sqrt(x² + y²)
})
const polar_to_chartesian = ({ radian, radius }) => ({
  x: Math.cos(radian) * radius,
  y: Math.sin(radian) * radius,
})
const rotate_point_by_angle = ({ x, y }, radian_delta) => {
  const polar = chartesian_to_polar({ x, y })
  return polar_to_chartesian({
    radian: polar.radian + radian_delta,
    radius: polar.radius
  }); // { x, y }
}
const fast_rotate_point_by_angle = ({ x, y }, radian_delta) => {
  // uses matrix multiplication
  const cos = Math.cos(radian_delta)
  const sin = Math.sin(radian_delta)

  return {
    x: x * cos - y * sin,
    y: y * cos + x * sin,
  }
}
const rotate_point_around_other_point_by_angle = (point, anchor, radian_delta)
 => {
  // treat anchor as origin
  const delta = { 
    x: point.x - anchor.x,
    y: point.y - anchor.y,
  }
  const delta_rotated = rotate_point_by_angle(delta, radian_delta);
  // and translate by anchor
  return {
    x: anchor.x + delta_rotated.x,
    y: anchor.y + delta_rotated.y,
  }
}

/// 2d grid
const taxi_distance = (x, y) => Math.abs(x) + Math.abs(y)
const taxi_distance_between_points = (a, b) =>
  taxi_distance(a.x - b.x, a.y - b.y);
const move_in_dir = (pos, dir) => {
  // dir = 0 (east), 1 (south), 2 (west), 3 (north)
  if (dir === 0) pos.x++
  else if (dir === 1) pos.y++
  else if (dir === 2) pos.x--
  else pos.y-- // dir === 3
}
const turn_and_move = (head, dir) => {
  // dir = 0 (ahead), 1 (right), 2 (back), 3 (left)
  head.dir = head.dir + dir % 4
  move_in_dir(head, head.dir)
}
