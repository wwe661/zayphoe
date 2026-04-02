from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models  # noqa: ensure all models are registered

from routers import auth, admin, groups, users, friends

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Zay Phoe – Expense Distribution API",
    description="Multi-user expense splitting platform with role-based access",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(groups.router)
app.include_router(users.router)
app.include_router(friends.router)


@app.get("/")
def root():
    return {"message": "Zay Phoe API is running"}
