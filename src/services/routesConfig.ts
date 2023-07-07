import type { Coordinate } from '@trainlink-org/trainlink-types';
import type { TurnoutMap } from '../turnouts';

/**
 * Updates a turnouts coordinate
 * @param id The id of the turnout to update
 * @param coord The new coordinate to update
 * @param turnoutMap The TurnoutMap instance
 */
export function changeCoordinate(
    id: number,
    coord: Coordinate,
    turnoutMap: TurnoutMap
) {
    if (id > 0) {
        turnoutMap.updateTurnoutCoordinate(id, coord);
    }
}
