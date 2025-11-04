from typing import List, Dict, NamedTuple, Set

EntityId = int
ComponentId = int
ArchetypeId = int

Type = str
Types = List[ComponentId]
Column = List
class Archetype(NamedTuple):
    id: ArchetypeId
    type: Type
    types: Types
    columns: List[Column]
    columns_map: Dict[ComponentId, Column]
    entities: List[EntityId]

Archetypes = Dict[ArchetypeId, Archetype]
ArchetypeIndex = Dict[Type, Archetype]

class Record():
    archetype: Archetype
    row: int

    def __init__(self, archetype: Archetype, row: int):
        self.archetype = archetype
        self.row = row

EntityIndex = Dict[EntityId, Record]

ComponentRecord = Dict[ArchetypeId, int]
ComponentIndex = Dict[ComponentId, ComponentRecord]

ROOT_ARCHETYPE_ID = 0
ROOT_ARCHETYPE_TYPE = ""
ROOT_ARCHETYPE = Archetype(ROOT_ARCHETYPE_ID, ROOT_ARCHETYPE_TYPE, [], [], {}, [])

def hash_types(types: Types) -> Type:
    return "_".join([str(id) for id in types])

def find_insert(types: Types, to_add: ComponentId) -> int:
    for index, id in enumerate(types):
        if id == to_add:
            return -1
        elif id > to_add:
            return index
    return len(types)

class World():
    archetypes: Archetypes
    entity_index: EntityIndex
    component_index: ComponentIndex
    archetype_index: ArchetypeIndex

    def __init__(self):
        self.archetypes = {ROOT_ARCHETYPE_ID: ROOT_ARCHETYPE}
        self.entity_index = {}
        self.component_index = {}
        self.archetype_index = {ROOT_ARCHETYPE_TYPE: ROOT_ARCHETYPE}

    def __archetype_create(self, types: Types, type: Type) -> Archetype:
        archetype_id = len(self.archetypes)
        archetype = Archetype(archetype_id, type, types, [], {}, [])

        columns = archetype.columns
        columns_map = archetype.columns_map

        for index, component in enumerate(types):
            column = []
            columns.append(column)
            columns_map[component] = column
            self.component_index[component][archetype_id] = index

        self.archetypes[archetype_id] = archetype
        self.archetype_index[type] = archetype

        return archetype

    def __archetype_ensure(self, types: Types) -> Archetype:
        if len(types) < 1:
            return ROOT_ARCHETYPE
        
        type = hash_types(types)
        archetype = self.archetype_index.get(type)
        if archetype != None:
            return archetype
        
        return self.__archetype_create(types, type)
    
    def __archetype_append(self, entity: EntityId, archetype: Archetype) -> int:
        entities = archetype.entities
        row = len(entities)
        entities.append(entity)
        return row
    
    def __entity_move(self, entity: EntityId, record: Record, to: Archetype):
        source = record.archetype
        source_row = record.row
        source_types = source.types
        source_columns = source.columns
        source_entities = source.entities
        source_last_row = len(source_entities) - 1

        to_row = self.__archetype_append(entity, to)
        to_columns_map = to.columns_map

        if source_row != source_last_row:
            for index, column in enumerate(source_columns):
                component = source_types[index]
                to_column = to_columns_map.get(component)

                if to_column != None:
                    to_column.append(column[source_row])

                column[source_row] = column[source_last_row]
                del column[source_last_row]
                
            last_entity = source_entities[source_last_row]
            source_entities[source_row] = last_entity
            
            last_entity_record = self.entity_index[last_entity]
            last_entity_record.row = source_row
        else:
            for index, column in enumerate(source_columns):
                component = source_types[index]
                to_column = to_columns_map.get(component)

                if to_column != None:
                    to_column.append(column[source_row])

                del column[source_last_row]

        del source_entities[source_last_row]

        record.archetype = to
        record.row = to_row


    def entity(self) -> EntityId:
        entity_index = self.entity_index

        entity_id = len(entity_index)
        row = self.__archetype_append(entity_id, ROOT_ARCHETYPE)
        entity_index[entity_id] = Record(ROOT_ARCHETYPE, row)

        return entity_id
    
    def component(self) -> ComponentId:
        component_index = self.component_index

        component_id = len(component_index) + 1
        component_index[component_id] = {}

        return component_id
    
    def has(self, entity: EntityId, component: ComponentId) -> bool:
        record = self.entity_index[entity]
        archetype = record.archetype
        return component in archetype.columns_map

    def get(self, entity: EntityId, component: ComponentId):
        record = self.entity_index[entity]
        archetype = record.archetype

        columns_map = archetype.columns_map
        if not (component in columns_map):
            return None
        
        return columns_map[component][record.row]
    
    def set(self, entity: EntityId, component: ComponentId, value):
        record = self.entity_index[entity]
        archetype = record.archetype

        if not (component in archetype.columns_map):
            types = archetype.types.copy()
            insert_at = find_insert(types, component)
            types.insert(insert_at, component)

            to_archetype = self.__archetype_ensure(types)
            self.__entity_move(entity, record, to_archetype)
            archetype = to_archetype
                
        column = archetype.columns_map[component]
        column.insert(record.row, value)

    def remove(self, entity: EntityId, component: ComponentId):
        record = self.entity_index[entity]
        archetype = record.archetype

        if not (component in archetype.columns_map):
            return
        
        index = archetype.types.index(component)
        types = archetype.types.copy()
        types.pop(index)

        to_archetype = self.__archetype_ensure(types)
        self.__entity_move(entity, record, to_archetype)

        
world = World()