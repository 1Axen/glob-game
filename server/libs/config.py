import json
from typing import NamedTuple

class GameConfig(NamedTuple):
    width: int
    height: int

    maximum_speed: float
    minimum_speed: float
    friction: float
    acceleration: float

    maximum_mass: float
    minimum_mass: float

    eject_mass: float
    starting_mass: float

    food_mass: tuple[float, float]
    virus_mass: tuple[float, float]
    maximum_food: int
    maximum_viruses: int

    base_radius: float
    mass_radius_consant: float

    merge_debounce: float
    maximum_splits: int

class ServerConfig(NamedTuple):
    port: int
    hostname: str
    update_rate: int

class Config(NamedTuple):
    game: GameConfig
    server: ServerConfig

    @classmethod
    def from_file(cls, file_path: str):
        contents: dict = json.load(open(file_path))

        game_dict: dict = contents["game"]
        food_mass: list[float] = game_dict["food_mass"]
        virus_mass: list[float] = game_dict["virus_mass"]

        game_config = GameConfig(
            game_dict["width"], 
            game_dict["height"], 
            game_dict["maximum_speed"], 
            game_dict["minimum_speed"], 
            game_dict["friction"], 
            game_dict["acceleration"], 
            game_dict["maximum_mass"], 
            game_dict["minimum_mass"], 
            game_dict["eject_mass"],
            game_dict["starting_mass"], 
            (food_mass[0], food_mass[1]),
            (virus_mass[0], virus_mass[1]), 
            game_dict["maximum_food"], 
            game_dict["maximum_viruses"],
            game_dict["base_radius"],
            game_dict["mass_radius_constant"],
            game_dict["merge_debounce"],
            game_dict["maximum_splits"]
        )

        server_dict: dict = contents["server"]
        server_config = ServerConfig(
            server_dict["port"],
            server_dict["hostname"],
            server_dict["update_rate"]
        )

        return cls(game_config, server_config)