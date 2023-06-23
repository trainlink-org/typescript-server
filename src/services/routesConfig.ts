// import { turnoutMap } from '../index';
import type { Coordinate } from '@trainlink-org/trainlink-types';
import type { TurnoutMap } from '../turnouts';

export function changeCoordinate(
    id: number,
    coord: Coordinate,
    turnoutMap: TurnoutMap
) {
    if (id > 0) {
        turnoutMap.updateTurnoutCoordinate(id, coord);
    }
}
