from libs.ecs import Id
from libs.vector import Vector
from typing import List, Dict

CELL_SIZE = 16

class VectorMap:
    map: Dict[int, List[Id]]

    def __init__(self) -> None:
        self.map = {}
        pass

    def insert(self, id: Id, position: Vector):
        map = self.map

        key = hash(position // CELL_SIZE)
        cell = map.get(key, None)

        if (cell == None):
            cell = []
            map[key] = cell

        cell.append(id)

    def remove(self, id: Id, position: Vector):
        map = self.map

        key = hash(position // CELL_SIZE)
        cell = map.get(key, None)
        if (cell == None):
            return
        
        cell.remove(id)

    def query_radius(self, position: Vector, radius: float) -> List[Id]:
        map = self.map
        min = (position - radius) // CELL_SIZE
        max = (position + radius) // CELL_SIZE
        
        inserted_set = set()
        collected_ids = []
        
        for x in range(int(min.x), int(max.x)):
            for y in range(int(min.y), int(max.y)):
                key = hash(Vector(x, y))
                cell = map.get(key, None)

                if (cell == None):
                    continue

                for id in cell:
                    if id in inserted_set:
                        continue

                    inserted_set.add(id)
                    collected_ids.append(id)

        return collected_ids