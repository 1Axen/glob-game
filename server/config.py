import json
from typing import NamedTuple

class GameConfig(NamedTuple):
    width: int
    height: int

    maximum_speed: float
    minimum_speed: float

    maximum_mass: int
    minimum_mass: int
    starting_mass: int

    food_mass: int
    maximum_food: int
    maximum_viruses: int

    mass_radius_consant: int

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
        game_config = GameConfig(
            game_dict["width"], 
            game_dict["height"], 
            game_dict["maximum_speed"], 
            game_dict["minimum_speed"], 
            game_dict["maximum_mass"], 
            game_dict["minimum_mass"], 
            game_dict["starting_mass"], 
            game_dict["food_mass"], 
            game_dict["maximum_food"], 
            game_dict["maximum_viruses"],
            game_dict["mass_radius_constant"]
        )

        server_dict: dict = contents["server"]
        server_config = ServerConfig(
            server_dict["port"],
            server_dict["hostname"],
            server_dict["update_rate"]
        )

        return cls(game_config, server_config)