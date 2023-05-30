import { turnoutMap } from '../index';
import type { Coordinate } from '@trainlink-org/trainlink-types';

export function changeCoordinate(id: number, coord: Coordinate) {
    if (id > 0) {
        turnoutMap.updateTurnoutCoordinate(id, coord);
    }
}
