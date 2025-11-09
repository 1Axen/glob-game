import json
from typing import NamedTuple

class GameConfig(NamedTuple):
    width: int
    height: int
    minimum_mass: int
    starting_mass: int
    maximum_food: int
    maximum_viruses: int

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
            game_dict["minimum_mass"], 
            game_dict["starting_mass"], 
            game_dict["maximum_food"], 
            game_dict["maximum_viruses"]
        )

        server_dict: dict = contents["server"]
        server_config = ServerConfig(
            server_dict["port"],
            server_dict["hostname"],
            server_dict["update_rate"]
        )

        return cls(game_config, server_config)