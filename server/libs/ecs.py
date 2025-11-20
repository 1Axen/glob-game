from dataclasses import dataclass
from typing import List, Dict, NamedTuple, Tuple, TypeVar, Generic, TypeVarTuple, Unpack

Data = TypeVar("Data")
DataTuple = TypeVarTuple("DataTuple")

class Id(int, Generic[Data]):
    pass

ArchetypeId = int

Type = str
Types = List[Id]
Column = List
class Archetype(NamedTuple):
    id: ArchetypeId
    type: Type
    types: Types
    columns: List[Column]
    columns_map: Dict[Id, Column]
    entities: List[Id]

Archetypes = Dict[ArchetypeId, Archetype]
ArchetypeIndex = Dict[Type, Archetype]
ArchetypeEdges = Dict[ArchetypeId, Dict[Id, Archetype]]

@dataclass
class Record():
    archetype: Archetype
    row: int

class EntityIndex():
    sparse: Dict[Id, Record]
    size: int  = 0

    def __init__(self) -> None:
        self.sparse = {}
        pass

class ComponentRecord():
    size: int = 0
    is_tag: bool
    archetypes: Dict[ArchetypeId, int]

    def __init__(self, is_tag: bool):
        self.is_tag = is_tag
        self.archetypes = {}

class AddComponentException(Exception):
    pass

class SetTagException(Exception):
    pass

class SetNoneException(Exception):
    pass

ComponentIndex = Dict[Id, ComponentRecord]

TAG_COLUMN = []
MAX_COMPONENT_ID = 256
ROOT_ARCHETYPE_ID = 0
ROOT_ARCHETYPE_TYPE = ""

EcsComponent = Id(MAX_COMPONENT_ID + 1)
EcsRest = Id(MAX_COMPONENT_ID + 2)

max_prereg_tag = EcsRest
max_prereg_component = 0

def is_tag_column(column: List) -> bool:
    return id(column) == id(TAG_COLUMN)

def hash_types(types: Types) -> Type:
    return "_".join([str(id) for id in types])

def find_insert(types: Types, to_add: Id) -> int:
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
    archetype_edges: ArchetypeEdges
    root_archetype: Archetype

    def __init__(self):
        root_archetype = Archetype(ROOT_ARCHETYPE_ID, ROOT_ARCHETYPE_TYPE, [], [], {}, [])

        self.index = 0
        self.archetypes = {ROOT_ARCHETYPE_ID: root_archetype}
        self.entity_index = EntityIndex()
        self.component_index = {}
        self.archetype_index = {ROOT_ARCHETYPE_TYPE: root_archetype}
        self.archetype_edges = {ROOT_ARCHETYPE_ID: {}}
        self.root_archetype = root_archetype

        for _ in range(0, EcsRest):
            self.entity()

        for index in range(0, max_prereg_component):
            self.add(Id(index), EcsComponent)

        for _ in range(EcsRest, EcsRest + max_prereg_tag):
            self.entity()

    def __component_record_create(self, component: Id) -> ComponentRecord:
        is_tag = not self.has(component, EcsComponent)
        record = ComponentRecord(is_tag)
        self.component_index[component] = record
        return record

    def __component_record_ensure(self, component: Id) -> ComponentRecord:
        component_record = self.component_index.get(component, None)
        if (component_record != None):
            return component_record
        
        return self.__component_record_create(component)

    def __archetype_create(self, types: Types, type: Type) -> Archetype:
        archetype_id = len(self.archetypes)
        archetype = Archetype(archetype_id, type, types, [], {}, [])

        columns = archetype.columns
        columns_map = archetype.columns_map

        for index, component in enumerate(types):
            component_record = self.__component_record_ensure(component)

            column = TAG_COLUMN if component_record.is_tag else []
            columns.append(column)
            columns_map[component] = column

            component_record.size += 1
            component_record.archetypes[archetype_id] = index

        self.archetypes[archetype_id] = archetype
        self.archetype_index[type] = archetype
        self.archetype_edges[archetype_id] = {}

        return archetype

    def __archetype_ensure(self, types: Types) -> Archetype:
        if len(types) < 1:
            return self.root_archetype
        
        type = hash_types(types)
        archetype = self.archetype_index.get(type)
        if archetype != None:
            return archetype
        
        return self.__archetype_create(types, type)
    
    def __archetype_append(self, entity: Id, archetype: Archetype) -> int:
        entities = archetype.entities
        row = len(entities)
        entities.append(entity)
        return row
    
    def __entity_move(self, entity: Id, record: Record, to: Archetype):
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
                if (is_tag_column(column)):
                    continue

                component = source_types[index]
                to_column = to_columns_map.get(component)

                if to_column != None:
                    to_column.append(column[source_row])

                column[source_row] = column[source_last_row]
                del column[source_last_row]
                
            last_entity = source_entities[source_last_row]
            source_entities[source_row] = last_entity
            self.entity_index.sparse[last_entity].row = source_row
        else:
            for index, column in enumerate(source_columns):
                if (is_tag_column(column)):
                    continue

                component = source_types[index]
                to_column = to_columns_map.get(component)

                if to_column != None:
                    to_column.append(column[source_row])

                del column[source_last_row]

        del source_entities[source_last_row]

        record.archetype = to
        record.row = to_row

    def __find_archetype_with(self, id: Id, source: Archetype) -> Archetype:
        archetype_edges = self.archetype_edges
        source_edges = archetype_edges[source.id]
        to = source_edges.get(id)

        if (to == None):
            types = source.types.copy()
            insert_at = find_insert(types, id)
            types.insert(insert_at, id)
            to = self.__archetype_ensure(types)
            source_edges[id] = to
            archetype_edges[to.id][id] = source

        return to

    def entity(self) -> Id[None]:
        entity_index = self.entity_index
        root_archetype = self.root_archetype

        entity_id = Id(entity_index.size)
        entity_index.size += 1

        row = self.__archetype_append(entity_id, root_archetype)
        entity_index.sparse[entity_id] = Record(root_archetype, row)

        return entity_id
    
    def component(self, ttype: type[Data]) -> Id[Data]:
        component_index = self.component_index

        component_id = Id(len(component_index))
        self.add(component_id, EcsComponent)

        return component_id
    
    def contains(self, entity: Id) -> bool:
        return entity in self.entity_index.sparse
    
    def has(self, entity: Id, *components: Id) -> bool:
        record = self.entity_index.sparse.get(entity)
        if (record == None):
            return False
        
        archetype = record.archetype

        for component in components:
            if not component in archetype.columns_map:
                return False

        return True

    def get(self, entity: Id, component: Id[Data]) -> Data | None:
        record = self.entity_index.sparse.get(entity)
        if (record == None):
            return None

        archetype = record.archetype
        columns_map = archetype.columns_map

        if not (component in columns_map):
            return None

        column = columns_map[component]
        if is_tag_column(column):
            return None

        return column[record.row]
    
    def add(self, entity: Id, component: Id[None]):
        record = self.entity_index.sparse.get(entity)
        if (record == None):
            return

        source_archetype = record.archetype
        if (component in source_archetype.columns_map):
            return

        id_record = self.__component_record_ensure(component)
        if not id_record.is_tag:
            raise AddComponentException("Cannot add a component, use set instead")

        to_archetype = self.__find_archetype_with(component, source_archetype)
        self.__entity_move(entity, record, to_archetype)

    def set(self, entity: Id, component: Id[Data], value: Data):
        if (value == None):
            raise SetNoneException("Cannot set value to None, use remove instead")

        id_record = self.__component_record_ensure(component)
        if (id_record.is_tag):
            raise SetTagException("Cannot set a tag, use add instead")

        record = self.entity_index.sparse.get(entity)
        if (record == None):
            return
        
        source_archetype = record.archetype
        to_archetype = source_archetype

        if not (component in source_archetype.columns_map):
            to_archetype = self.__find_archetype_with(component, source_archetype)
            self.__entity_move(entity, record, to_archetype)
        
        column = to_archetype.columns_map[component]
        if len(column) > record.row:
            column[record.row] = value
        else:
            column.insert(record.row, value)

    def remove(self, entity: Id, component: Id):
        record = self.entity_index.sparse.get(entity)
        if (record == None):
            return

        source_archetype = record.archetype
        source_id = source_archetype.id
        id_record = self.__component_record_ensure(component)

        index = id_record.archetypes.get(source_id, None)
        if (index == None):
            return
        
        archetype_edges = self.archetype_edges
        source_edges = archetype_edges[source_id]

        to_archetype = source_edges.get(component)
        if (to_archetype == None):
            types = source_archetype.types.copy()
            types.pop(index)
            to_archetype = self.__archetype_ensure(types)

            source_edges[component] = to_archetype
            archetype_edges[to_archetype.id][component] = source_archetype

        self.__entity_move(entity, record, to_archetype)

    def delete(self, entity: Id):
        entity_index = self.entity_index
        record = self.entity_index.sparse.get(entity)
        if (record == None):
            return

        row = record.row
        archetype = record.archetype

        columns = archetype.columns
        entities = archetype.entities
        last_row = len(archetype.entities) - 1

        if row == last_row:
            for column in columns:
                if (is_tag_column(column)):
                    continue

                del column[row]
        else:
            for column in columns:
                if (is_tag_column(column)):
                    continue

                column[row] = column[last_row]
                del column[last_row]

            last_entity = entities[last_row]
            entities[row] = entities[last_row]
            entity_index.sparse[last_entity].row = row

        del entities[last_row]
        del entity_index.sparse[entity]

class Query():
    world: World
    terms: List[Id]
    with_terms: List[Id]
    without_terms: List[Id]

    index: int = -1
    last_archetype: int = -1
    matched_archetypes: List[Archetype]
    entities: List[Id] = []
    columns_map: Dict[Id, Column] = {}

    def with_ids(self, *terms: Id):
        self.with_terms += terms
        return self
    
    def without(self, *terms: Id):
        self.without_terms += terms
        return self

    def __init__(self, world: World, *terms: Id):
        self.world = world
        self.terms = list(terms)
        self.with_terms = list(terms)
        self.without_terms = []
        self.matched_archetypes = []

    def __iter__(self):
        world = self.world
        with_terms = self.with_terms
        without_terms = self.without_terms
        archetypes = world.archetypes
        component_index = world.component_index

        smallest_record: ComponentRecord | None = None
        for component in with_terms:
            component_record = component_index.get(component, None)
            if component_record == None:
                continue

            if smallest_record == None:
                smallest_record = component_record
            elif component_record.size < smallest_record.size:
                smallest_record = component_record

        if smallest_record != None:
            matched_archetypes = self.matched_archetypes
            for archetype_id in smallest_record.archetypes:
                archetype = archetypes[archetype_id]
                columns_map = archetype.columns_map

                doesnt_match = False
                for component in with_terms:
                    if not component in columns_map:
                        doesnt_match = True
                        break

                if doesnt_match:
                    continue

                for component in without_terms:
                    if component in columns_map:
                        doesnt_match = True
                        break
                
                if doesnt_match:
                    continue

                matched_archetypes.append(archetype)

        return self
    
    def __next__(self):
        index = self.index
        terms = self.terms
        entities = self.entities
        columns_map = self.columns_map
        last_archtype = self.last_archetype
        matched_archetypes = self.matched_archetypes
        
        entity = None
        if index >= 0:
            try:
                entity = entities[index]
            except:
                pass

        while entity == None:
            last_archtype += 1
            self.last_archetype = last_archtype

            if last_archtype >= len(matched_archetypes):
                raise StopIteration
            
            archetype = matched_archetypes[last_archtype]
            entities = archetype.entities
            index = len(entities) - 1

            if index == -1:
                continue

            entity = entities[index]
            columns_map = archetype.columns_map
            self.entities = entities
            self.columns_map = columns_map

        self.index = (index - 1)

        values = []
        for component in terms:
            column = columns_map[component]
            value = None if is_tag_column(column) else column[index] 
            values.append(value)

        return entity, *values

def tag() -> Id[None]:
    global max_prereg_tag
    max_prereg_tag += 1
    return Id(max_prereg_tag)

def component(ttype: type[Data]) -> Id[Data]:
    global max_prereg_component
    component_id = max_prereg_component
    max_prereg_component += 1
    return Id(component_id)