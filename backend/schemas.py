from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from models import UserRole, SplitMode


# ─── Auth ────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.user


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    role: UserRole
    user_id: int
    username: str


# ─── User ────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Friends ─────────────────────────────────────────────────────────────────

from models import FriendshipStatus

class FriendRequestCreate(BaseModel):
    addressee_id: int

class FriendshipOut(BaseModel):
    id: int
    requester_id: int
    addressee_id: int
    status: FriendshipStatus
    created_at: datetime
    requester: UserOut
    addressee: UserOut

    class Config:
        from_attributes = True


# ─── Group ───────────────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class GroupOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Group Members ────────────────────────────────────────────────────────────

class MemberAdd(BaseModel):
    user_id: int


class MemberOut(BaseModel):
    id: int
    user_id: int
    group_id: int
    joined_at: datetime
    user: UserOut

    class Config:
        from_attributes = True


# ─── Expenses ────────────────────────────────────────────────────────────────

class ShareInput(BaseModel):
    debtor_id: int
    share_amount: float


class ExpenseCreate(BaseModel):
    paid_by: int
    amount: float
    description: Optional[str] = None
    split_mode: SplitMode = SplitMode.equal
    # For custom split: provide shares. For equal: leave empty.
    custom_shares: Optional[List[ShareInput]] = None


class ExpenseShareOut(BaseModel):
    id: int
    debtor_id: int
    share_amount: float
    debtor: UserOut

    class Config:
        from_attributes = True


class ExpenseOut(BaseModel):
    id: int
    group_id: int
    paid_by: int
    amount: float
    description: Optional[str]
    split_mode: SplitMode
    date: datetime
    paid_by_user: UserOut
    shares: List[ExpenseShareOut]

    class Config:
        from_attributes = True


# ─── Manual Debits ───────────────────────────────────────────────────────────

class DebitEntry(BaseModel):
    debtor_id: int
    amount: float


class ManualDebitCreate(BaseModel):
    entries: List[DebitEntry]   # charge one or more members at once
    reason: Optional[str] = None
    custom_date: Optional[datetime] = None  # if provided, override the auto timestamp


class ManualDebitOut(BaseModel):
    id: int
    group_id: int
    debtor_id: int
    recorded_by: int
    amount: float
    reason: Optional[str]
    date: datetime
    debtor: UserOut

    class Config:
        from_attributes = True


# ─── Settlements ─────────────────────────────────────────────────────────────

class SettlementCreate(BaseModel):
    debtor_id: int
    creditor_id: int
    amount: float
    note: Optional[str] = None


class SettlementOut(BaseModel):
    id: int
    group_id: int
    debtor_id: int
    creditor_id: int
    amount: float
    note: Optional[str]
    is_paid: bool
    paid_at: Optional[datetime]
    created_at: datetime
    debtor: UserOut
    creditor: UserOut

    class Config:
        from_attributes = True


# ─── Summary ─────────────────────────────────────────────────────────────────

class MemberBalance(BaseModel):
    user_id: int
    username: str
    total_owed: float        # amount this member owes others
    total_to_receive: float  # amount others owe this member
    net_balance: float       # positive = net creditor, negative = net debtor


class GroupSummary(BaseModel):
    group_id: int
    group_name: str
    balances: List[MemberBalance]
