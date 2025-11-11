export type Id<T = any> = number & {__T: T}
type ArchetypeId = number

type Type = string
type Types = Id[]
type Column = any[]

interface Archetype {
    id: ArchetypeId
    type: Type
    types: Types
    columns: Column[]
    columns_map: Map<Id, Column>
    entities: Id[]
}

type Archetypes = Archetype[]
type ArchetypeIndex = Map<Type, Archetype>

interface Record {
    row: number,
    archetype: Archetype
}

interface EntityIndex {
    size: number,
    sparse: Map<Id, Record>
}

interface ComponentRecord {
    size: number,
    is_tag: boolean,
    archetypes: Map<ArchetypeId, number>
}

type ComponentIndex = ComponentRecord[]

const TAG_COLUMN: any[] = []
Object.freeze(TAG_COLUMN)

const MAX_COMPONENT_ID = 256

const ROOT_ID = 0
const ROOT_TYPE = ""

const EcsComponent = (MAX_COMPONENT_ID + 1) as Id
const EcsRest = (MAX_COMPONENT_ID + 2) as Id

var max_prereg_component_id = 0
var max_prereg_tag_id = EcsRest as number

function hash_types(types: Types): Type {
    return types.join("_")
}

function find_insert(types: Types, to_add: Id): number {
    for (const [index, id] of types.entries()) {
        if (id == to_add) {
            return -1
        }
        else if (id > to_add) {
            return index
        }
    }
    return types.length
}

interface QueryIterator<T> {
    with(...ids: Id[]): QueryIterator<T>,
    [Symbol.iterator](): Iterator<T>,
}

function create_query(world: World, ids: Id[]) {
    var filter_with: Id[] = ids

    return {
        with(...with_ids: Id[]) {
            filter_with = filter_with.concat(with_ids)
            return this
        },

        [Symbol.iterator]() {
            const component_index = world.component_index
            var smallest_record: ComponentRecord | null = null
            for (const component of filter_with) {
                const record = component_index[component]
                if (record == undefined) {
                    return { next() { 
                        return {done: true}
                    } }
                }

                if (smallest_record == null || record.size < smallest_record.size) {
                    smallest_record = record
                }
            }

            const archetypes = world.archetypes
            const matched_archetypes: Archetype[] = []
            if (smallest_record != null) {
                for (const archetype_id of smallest_record.archetypes.keys()) {
                    const archetype = archetypes[archetype_id]
                    const columns_map = archetype.columns_map

                    var doesnt_match = false
                    for (const component of filter_with) {
                        if (!columns_map.has(component)) {
                            doesnt_match = true
                            break
                        }
                    }

                    if (doesnt_match) {
                        continue
                    }

                    matched_archetypes.push(archetype)
                }
            } 

            var last_archetype = 0
            var archetype = matched_archetypes[last_archetype]
            if (archetype == undefined) {
                return { next() { 
                    return {done: true}
                } }
            }

            var entities = archetype.entities
            var index = entities.length - 1
            var columns_map = archetype.columns_map

            return {
                next: () => {
                    var entity = entities[index]
                    while (entity == undefined) {
                        last_archetype += 1
                        archetype = matched_archetypes[last_archetype]
                        if (archetype == undefined) {
                            return { done: true }
                        }

                        entities = archetype.entities
                        index = entities.length - 1

                        if (index == -1) {
                            continue
                        }

                        entity = entities[index]
                        columns_map = archetype.columns_map
                    }

                    const row = index
                    index -= 1
                    
                    const values: any[] = [entity]
                    for (const component of ids) {
                        const column = columns_map.get(component)
                        const value = (column === TAG_COLUMN ? undefined : column[row])
                        values.push(value)
                    }

                    return {value: values}
                }
            }
        },
        
    }
}

export class World {
    archetypes: Archetypes
    entity_index: EntityIndex
    root_archetype: Archetype
    component_index: ComponentIndex
    archetype_index: ArchetypeIndex
    private max_component_id: number

    constructor() {
        const ROOT_ARCHETYPE: Archetype = {
            id: ROOT_ID,
            type: ROOT_TYPE,
            types: [],
            columns: [],
            columns_map: new Map(),
            entities: []
        }

        const archetypes: Archetypes = []
        archetypes[ROOT_ID] = ROOT_ARCHETYPE

        const archetype_index: ArchetypeIndex = new Map()
        archetype_index.set(ROOT_TYPE, ROOT_ARCHETYPE)

        this.archetypes = archetypes
        this.entity_index = {
            size: 0,
            sparse: new Map()
        }
        this.component_index = []
        this.archetype_index = archetype_index
        this.root_archetype = ROOT_ARCHETYPE
        this.max_component_id = max_prereg_component_id

        for (let index = 0; index <= EcsRest; index++) {
            this.entity()
        }

        for (let index = 0; index < max_prereg_component_id; index++) {
            this.add(index as Id, EcsComponent)
        }

        for (let index = EcsRest; index < max_prereg_tag_id; index++) {
            this.entity()
        }
    }

    private component_record_create(component: Id): ComponentRecord {
        const record: ComponentRecord = {
            size: 0,
            is_tag: !this.has(component, EcsComponent),
            archetypes: new Map()
        }

        this.component_index[component] = record
        return record
    }

    private component_record_ensure(component: Id): ComponentRecord {
        const record = this.component_index[component]
        if (record != undefined) {
            return record
        }

        return this.component_record_create(component)
    }

    private archetype_create(types: Types, type: Type): Archetype {
        const archetype_id = this.archetypes.length
        const archetype: Archetype = {
            id: archetype_id,
            type: type,
            types: types,
            columns: [],
            columns_map: new Map(),
            entities: []
        }

        const columns = archetype.columns
        const columns_map = archetype.columns_map

        for (const [index, component] of types.entries()) {
            const record = this.component_record_ensure(component)
            const column: any[] = record.is_tag ? TAG_COLUMN : []

            columns.push(column)
            columns_map.set(component, column)

            record.size += 1
            record.archetypes.set(archetype_id, index)
        }

        this.archetypes[archetype_id] = archetype
        this.archetype_index.set(type, archetype)

        return archetype
    }

    private archetype_ensure(types: Types): Archetype {
        if (types.length == 0) {
            return this.root_archetype
        }

        const type = hash_types(types)
        const archetype = this.archetype_index.get(type)
        if (archetype != undefined) {
            return archetype
        }

        return this.archetype_create(types, type)
    }

    private archetype_append(entity: Id, archetype: Archetype): number {
        const entities = archetype.entities
        const row = entities.length
        entities.push(entity)
        return row
    }

    private entity_move(entity: Id, record: Record, to: Archetype) {
        const entity_index = this.entity_index
        
        const source = record.archetype
        const source_row = record.row
        const source_types = source.types
        const source_columns = source.columns
        const source_entities = source.entities
        const source_last_row = source_entities.length - 1

        const to_row = this.archetype_append(entity, to)
        const to_columns_map = to.columns_map

        if (source_row != source_last_row) {
            for (const [index, column] of source_columns.entries()) {
                if (column === TAG_COLUMN) continue;

                const component = source_types[index]
                const to_column = to_columns_map.get(component)

                if (to_column != undefined) {
                    to_column.push(column[source_row])
                }

                column[source_row] = column.pop()
            }
            
            const last_entity = source_entities[source_last_row]
            source_entities[source_row] = last_entity
            entity_index.sparse.get(last_entity).row = source_row
        }
        else {
            for (const [index, column] of source_columns.entries()) {
                if (column === TAG_COLUMN) continue;

                const component = source_types[index]
                const to_column = to_columns_map.get(component)

                if (to_column != undefined) {
                    to_column.push(column[source_row])
                }

                column.pop()
            }
        }

        source_entities.pop()

        record.row = to_row
        record.archetype = to
    }

    entity(): Id {
        const entity_index = this.entity_index
        const root_archetype = this.root_archetype

        const entity_id = entity_index.size as Id
        entity_index.size += 1

        const row = this.archetype_append(entity_id, root_archetype)
        entity_index.sparse.set(entity_id, {
            row: row,
            archetype: root_archetype
        })

        return entity_id
    }

    component<T>(): Id<T> {
        const component_id = this.max_component_id as Id<T>
        this.max_component_id += 1
        this.add(component_id, EcsComponent)
        return component_id
    }

    has(entity: Id, component: Id): boolean {
        const record = this.entity_index.sparse.get(entity)
        const archetype = record.archetype
        return archetype.columns_map.has(component)
    }

    add(entity: Id, component: Id<undefined>) {
        const record = this.entity_index.sparse.get(entity)
        const archetype = record.archetype
        if (archetype.columns_map.has(component)) return;

        const types = archetype.types.slice()
        const insert_at = find_insert(types, component)
        types.splice(insert_at, 0, component)

        const to_archetype = this.archetype_ensure(types)
        this.entity_move(entity, record, to_archetype)
    }

    get<T>(entity: Id, component: Id<T>): T | undefined {
        const record = this.entity_index.sparse.get(entity)
        const archetype = record.archetype

        const columns_map = archetype.columns_map
        const column = columns_map.get(component)
        if (column == undefined) return undefined;

        return column[record.row]
    }

    set<T>(entity: Id, component: Id<T>, value: T) {
        const record = this.entity_index.sparse.get(entity)
        const archetype = record.archetype

        var column = archetype.columns_map.get(component)
        if (column == undefined) {
            const types = archetype.types.slice()
            const insert_at = find_insert(types, component)
            types.splice(insert_at, 0, component)

            const to_archetype = this.archetype_ensure(types)
            this.entity_move(entity, record, to_archetype)
            column = to_archetype.columns_map.get(component)
        }

        column[record.row] = value
    }

    remove(entity: Id, component: Id) {
        const record = this.entity_index.sparse.get(entity)
        const archetype = record.archetype

        const component_record = this.component_index[component]
        const index = component_record.archetypes.get(archetype.id)
        if (index == undefined) return;

        const types = archetype.types.splice(index, 1)
        const to_archetype = this.archetype_ensure(types)
        this.entity_move(entity, record, to_archetype)
    }

    delete(entity: Id) {
        const entity_index = this.entity_index
        const record = entity_index.sparse.get(entity)

        const row = record.row
        const archetype = record.archetype

        const columns = archetype.columns
        const entities = archetype.entities
        const last_row = entities.length - 1

        if (row == last_row) {
            for (const column of columns.values()) {
                if (column === TAG_COLUMN) continue;
                column.pop()
            }
        }
        else {
            for (const column of columns.values()) {
                if (column === TAG_COLUMN) continue;
                column[row] = column[last_row]
                column.pop()
            }

            const last_entity = entities[last_row]
            entities[row] = last_entity
            entity_index.sparse.get(last_entity).row = row
        }

        entities.pop()
        entity_index.sparse.delete(entity)
    }

    query<A, B, C, D, E, F, G>(
        A?: Id<A>, 
        B?: Id<B>, 
        C?: Id<C>, 
        D?: Id<D>, 
        E?: Id<E>, 
        F?: Id<F>, 
        G?: Id<G>
    ): QueryIterator<[Id, A, B, C, D, E, F, G]> {
        var ids = [A, B, C, D, E, F, G]
        ids = ids.slice(0, ids.indexOf(undefined))
        return create_query(this, ids) as any
    }
}

export function tag(): Id<undefined> {
    max_prereg_tag_id += 1
    return max_prereg_tag_id as Id<undefined>
}

export function component<T>(): Id<T> {
    const component_id = max_prereg_component_id as Id<T>
    max_prereg_component_id += 1
    return component_id 
}

export default {
    world: World,
    tag: tag,
    component: component
}