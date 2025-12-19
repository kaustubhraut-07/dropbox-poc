from pydantic import BaseModel

class SignRequest(BaseModel):
    email: str
    name: str
