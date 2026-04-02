from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from auth import decode_token
from models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    import sys
    print(f"DEBUG: Processing token: {token}", file=sys.stderr)
    payload = decode_token(token)
    if payload is None:
        print("DEBUG: decode_token returned None", file=sys.stderr)
        raise credentials_exception
    
    user_id_raw = payload.get("sub")
    if user_id_raw is None:
        print("DEBUG: user_id_raw is None", file=sys.stderr)
        raise credentials_exception
        
    try:
        user_id = int(user_id_raw)
    except ValueError:
        print(f"DEBUG: ValueError parsing int({user_id_raw})", file=sys.stderr)
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        print(f"DEBUG: User not found for id {user_id}", file=sys.stderr)
        raise credentials_exception
    return user


def require_role(*roles: UserRole):
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value for r in roles]}"
            )
        return current_user
    return checker


require_admin = require_role(UserRole.admin)
require_any = require_role(UserRole.admin, UserRole.user)
