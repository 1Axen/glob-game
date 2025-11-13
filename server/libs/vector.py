from typing import NamedTuple, SupportsIndex
from math import sqrt, pow, inf

class Vector():
    x: float
    y: float

    __name__ = "vector"

    def __init__(self, x: float = 0, y: float = 0) -> None:
        self.x = x
        self.y = y

    def __eq__(self, value: object) -> bool:
        if isinstance(value, Vector):
            return self.x == value.x and self.y == value.y
        
        return False

    def __add__(self, vector_or_scalar):
        if isinstance(vector_or_scalar, (int, float)):
            scalar = vector_or_scalar
            return self.__class__(self.x + scalar, self.y + scalar)

        vector = vector_or_scalar
        return self.__class__(self.x + vector.x, self.y + vector.y)

    
    def __sub__(self, vector_or_scalar):
        if isinstance(vector_or_scalar, (int, float)):
            scalar = vector_or_scalar
            return self.__class__(self.x - scalar, self.y - scalar)

        vector = vector_or_scalar
        return self.__class__(self.x - vector.x, self.y - vector.y)

    def __mul__(self, scalar: float):
        return self.__class__(self.x * scalar, self.y * scalar)
    
    def __truediv__(self, scalar: float):
        return self.__class__(self.x / scalar, self.y / scalar)
    
    def __floordiv__(self, scalar: float):
        return self.__class__(float(self.x // scalar), float(self.y // scalar))
    
    def __str__(self) -> str:
        return f"<{self.x:.2f}, {self.y:.2f}>"
    
    def __hash__(self) -> int:
        return hash((self.x, self.y))

EPSILON = 1E-5
    
def magnitude(vector: Vector) -> float:
    return sqrt((vector.x * vector.x) + (vector.y * vector.y))

def normalize(vector: Vector) -> Vector:
    length = magnitude(vector)
    return Vector(vector.x / length, vector.y / length)

def friction(vector: Vector, strength: float, delta_time: float) -> Vector:
    coefficient = 1.0 / (1.0 + (strength * delta_time))
    length = magnitude(vector) * coefficient
    if (length < EPSILON):
        return Vector()
    
    return normalize(vector) * length

def accelerate(velocity: Vector, direction: Vector, max_speed: float, acceleration: float, delta_time: float) -> Vector:
    if magnitude(velocity) > max_speed:
        velocity = normalize(velocity) * max_speed

    target_velocity = direction * max_speed

    velocity_change = target_velocity - velocity
    change_magnitude = magnitude(velocity_change)
    acceleration_magnitude = (max_speed * acceleration) * delta_time

    if acceleration_magnitude > change_magnitude:
        acceleration_magnitude = change_magnitude

    if acceleration_magnitude < EPSILON:
        return target_velocity
    
    return velocity + (normalize(velocity_change) * acceleration_magnitude)
