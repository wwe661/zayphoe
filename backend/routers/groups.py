from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import (
    Group, GroupMember, User, Expense, ExpenseShare,
    ManualDebit, Settlement, SplitMode, Friendship, FriendshipStatus
)
from schemas import (
    MemberAdd, MemberOut,
    ExpenseCreate, ExpenseOut,
    ManualDebitCreate, ManualDebitOut,
    SettlementCreate, SettlementOut,
    GroupSummary, MemberBalance,
    GroupCreate, GroupOut,
)
from dependencies import require_any, get_current_user
from datetime import datetime

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group_owner(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    """Group owner (or main admin) can delete their own group with full cascade."""
    group = assert_group_admin(group_id, current_user, db)
    expenses = db.query(Expense).filter(Expense.group_id == group_id).all()
    for exp in expenses:
        db.query(ExpenseShare).filter(ExpenseShare.expense_id == exp.id).delete()
        db.delete(exp)
    db.query(ManualDebit).filter(ManualDebit.group_id == group_id).delete()
    db.query(Settlement).filter(Settlement.group_id == group_id).delete()
    db.query(GroupMember).filter(GroupMember.group_id == group_id).delete()
    db.delete(group)
    db.commit()


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    group = Group(name=payload.name, description=payload.description, created_by=current_user.id)
    db.add(group)
    db.flush()
    member = GroupMember(group_id=group.id, user_id=current_user.id)
    db.add(member)
    db.commit()
    db.refresh(group)
    return group

@router.get("/{group_id}", response_model=GroupOut)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    assert_group_member(group_id, current_user, db)
    return group

# ─── Helper: assert caller is admin of this group ─────────────────────────────

def assert_group_admin(group_id: int, current_user: User, db: Session):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    from models import UserRole
    if current_user.role == UserRole.admin:
        return group
    if group.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the group owner can perform this action")
    return group


def assert_group_member(group_id: int, current_user: User, db: Session):
    from models import UserRole
    if current_user.role == UserRole.admin:
        return
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group")


# ─── Eligible friends for adding to a group ───────────────────────────────────

@router.get("/{group_id}/eligible-friends")
def eligible_friends(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    """Return accepted friends of current user who are not yet in this group."""
    assert_group_admin(group_id, current_user, db)

    # All accepted friendships involving current user
    friendships = db.query(Friendship).filter(
        Friendship.status == FriendshipStatus.accepted,
        (Friendship.requester_id == current_user.id) | (Friendship.addressee_id == current_user.id),
    ).all()

    friend_ids = set()
    for f in friendships:
        other = f.addressee_id if f.requester_id == current_user.id else f.requester_id
        friend_ids.add(other)

    # Members already in group
    existing_member_ids = {
        m.user_id for m in db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
    }

    eligible_ids = friend_ids - existing_member_ids
    users = db.query(User).filter(User.id.in_(eligible_ids)).all()
    return [{"id": u.id, "username": u.username} for u in users]


# ─── Members ──────────────────────────────────────────────────────────────────

@router.get("/{group_id}/members", response_model=List[MemberOut])
def list_members(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_member(group_id, current_user, db)
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id)
        .all()
    )


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
def add_member(
    group_id: int,
    payload: MemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_admin(group_id, current_user, db)
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == payload.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already in this group")
    member = GroupMember(group_id=group_id, user_id=payload.user_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"message": "Member added", "member_id": member.id}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_admin(group_id, current_user, db)
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in group")
    db.delete(member)
    db.commit()


# ─── Expenses ─────────────────────────────────────────────────────────────────

@router.post("/{group_id}/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    group_id: int,
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_admin(group_id, current_user, db)

    # Validate payer is in group
    payer_member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == payload.paid_by,
    ).first()
    if not payer_member:
        raise HTTPException(status_code=400, detail="Payer is not a member of this group")

    expense = Expense(
        group_id=group_id,
        paid_by=payload.paid_by,
        amount=payload.amount,
        description=payload.description,
        split_mode=payload.split_mode,
    )
    db.add(expense)
    db.flush()  # get expense.id

    # Build shares
    all_members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
    debtor_ids = [m.user_id for m in all_members if m.user_id != payload.paid_by]

    if payload.split_mode == SplitMode.equal:
        n = len(all_members)
        if n == 0:
            raise HTTPException(status_code=400, detail="No members in group")
        share = round(payload.amount / n, 2)
        for debtor_id in debtor_ids:
            db.add(ExpenseShare(expense_id=expense.id, debtor_id=debtor_id, share_amount=share))

    elif payload.split_mode == SplitMode.custom:
        if not payload.custom_shares:
            raise HTTPException(status_code=400, detail="Custom split requires custom_shares")
        # Support partial custom: owner assigns some members, rest split equally among unassigned debtors
        assigned = {s.debtor_id: s.share_amount for s in payload.custom_shares}
        assigned_total = sum(assigned.values())
        if round(assigned_total, 2) > round(payload.amount, 2):
            raise HTTPException(
                status_code=400,
                detail=f"Custom shares sum ({assigned_total}) exceeds expense amount ({payload.amount})"
            )
        unassigned_debtors = [d for d in debtor_ids if d not in assigned]
        remaining = payload.amount - assigned_total
        # Add assigned shares
        for debtor_id, amount in assigned.items():
            db.add(ExpenseShare(expense_id=expense.id, debtor_id=debtor_id, share_amount=round(amount, 2)))
        # Split remaining equally among unassigned debtors (including unassigned payer? No — payer doesn't owe themselves)
        if unassigned_debtors:
            equal_share = round(remaining / len(unassigned_debtors), 2)
            for debtor_id in unassigned_debtors:
                db.add(ExpenseShare(expense_id=expense.id, debtor_id=debtor_id, share_amount=equal_share))

    db.commit()
    db.refresh(expense)
    return expense


@router.get("/{group_id}/expenses", response_model=List[ExpenseOut])
def list_expenses(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_member(group_id, current_user, db)
    return db.query(Expense).filter(Expense.group_id == group_id).order_by(Expense.date.desc()).all()


@router.delete("/{group_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    group_id: int,
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_admin(group_id, current_user, db)
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.group_id == group_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()


# ─── Manual Debits (Deposits) ─────────────────────────────────────────────────

@router.post("/{group_id}/debits", status_code=status.HTTP_201_CREATED)
def create_manual_debits(
    group_id: int,
    payload: ManualDebitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_admin(group_id, current_user, db)
    created = []
    for entry in payload.entries:
        member = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == entry.debtor_id,
        ).first()
        if not member:
            raise HTTPException(
                status_code=400,
                detail=f"User {entry.debtor_id} is not a member of this group"
            )
        debit_kwargs = dict(
            group_id=group_id,
            debtor_id=entry.debtor_id,
            recorded_by=current_user.id,
            amount=entry.amount,
            reason=payload.reason,
        )
        if payload.custom_date:
            debit_kwargs['date'] = payload.custom_date
        debit = ManualDebit(**debit_kwargs)
        db.add(debit)
        created.append(entry.debtor_id)
    db.commit()
    return {"message": "Debits recorded", "charged_members": created}


@router.get("/{group_id}/debits", response_model=List[ManualDebitOut])
def list_debits(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_member(group_id, current_user, db)
    return db.query(ManualDebit).filter(ManualDebit.group_id == group_id).order_by(ManualDebit.date.desc()).all()


@router.delete("/{group_id}/debits/{debit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_debit(
    group_id: int,
    debit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_admin(group_id, current_user, db)
    debit = db.query(ManualDebit).filter(ManualDebit.id == debit_id, ManualDebit.group_id == group_id).first()
    if not debit:
        raise HTTPException(status_code=404, detail="Debit not found")
    db.delete(debit)
    db.commit()


# ─── Summary ──────────────────────────────────────────────────────────────────

@router.get("/{group_id}/summary", response_model=GroupSummary)
def group_summary(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_member(group_id, current_user, db)
    group = db.query(Group).filter(Group.id == group_id).first()
    members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()

    balances = []
    for gm in members:
        user = gm.user
        expense_debt = sum(
            s.share_amount
            for e in db.query(Expense).filter(Expense.group_id == group_id).all()
            for s in e.shares
            if s.debtor_id == user.id
        )
        manual_debt = sum(
            d.amount
            for d in db.query(ManualDebit).filter(
                ManualDebit.group_id == group_id,
                ManualDebit.debtor_id == user.id,
            ).all()
        )
        total_owed = round(expense_debt + manual_debt, 2)

        total_to_receive = sum(
            s.share_amount
            for e in db.query(Expense).filter(
                Expense.group_id == group_id,
                Expense.paid_by == user.id,
            ).all()
            for s in e.shares
        )
        total_to_receive = round(total_to_receive, 2)

        settled_paid = sum(
            s.amount
            for s in db.query(Settlement).filter(
                Settlement.group_id == group_id,
                Settlement.debtor_id == user.id,
                Settlement.is_paid == True,
            ).all()
        )
        settled_received = sum(
            s.amount
            for s in db.query(Settlement).filter(
                Settlement.group_id == group_id,
                Settlement.creditor_id == user.id,
                Settlement.is_paid == True,
            ).all()
        )

        net_owed = round(total_owed - settled_paid, 2)
        net_receive = round(total_to_receive - settled_received, 2)
        net_balance = round(net_receive - net_owed, 2)

        balances.append(MemberBalance(
            user_id=user.id,
            username=user.username,
            total_owed=net_owed,
            total_to_receive=net_receive,
            net_balance=net_balance,
        ))

    return GroupSummary(group_id=group.id, group_name=group.name, balances=balances)


# ─── Reset (Summarize & Clear) ────────────────────────────────────────────────

@router.post("/{group_id}/reset")
def reset_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    """Return final summary then delete all expenses, debits and settlements."""
    assert_group_admin(group_id, current_user, db)
    group = db.query(Group).filter(Group.id == group_id).first()
    members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()

    # Compute final balances before deletion
    final_balances = []
    for gm in members:
        u = gm.user
        expense_debt = sum(
            s.share_amount
            for e in db.query(Expense).filter(Expense.group_id == group_id).all()
            for s in e.shares
            if s.debtor_id == u.id
        )
        manual_debt = sum(
            d.amount for d in db.query(ManualDebit).filter(
                ManualDebit.group_id == group_id,
                ManualDebit.debtor_id == u.id,
            ).all()
        )
        total_paid = sum(
            s.share_amount
            for e in db.query(Expense).filter(
                Expense.group_id == group_id,
                Expense.paid_by == u.id,
            ).all()
            for s in e.shares
        )
        final_balances.append({
            "user_id": u.id,
            "username": u.username,
            "total_owed": round(expense_debt + manual_debt, 2),
            "total_to_receive": round(total_paid, 2),
            "net_balance": round(total_paid - expense_debt - manual_debt, 2),
        })

    # Cascade delete all financial data
    expenses = db.query(Expense).filter(Expense.group_id == group_id).all()
    for exp in expenses:
        db.query(ExpenseShare).filter(ExpenseShare.expense_id == exp.id).delete()
        db.delete(exp)

    db.query(ManualDebit).filter(ManualDebit.group_id == group_id).delete()
    db.query(Settlement).filter(Settlement.group_id == group_id).delete()
    db.commit()

    return {
        "message": "Group reset successfully",
        "group_id": group_id,
        "group_name": group.name,
        "final_balances": final_balances,
    }


# ─── Settlements ──────────────────────────────────────────────────────────────

@router.post("/{group_id}/settlements", response_model=SettlementOut, status_code=status.HTTP_201_CREATED)
def create_settlement(
    group_id: int,
    payload: SettlementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_admin(group_id, current_user, db)
    settlement = Settlement(
        group_id=group_id,
        debtor_id=payload.debtor_id,
        creditor_id=payload.creditor_id,
        amount=payload.amount,
        note=payload.note,
        is_paid=True,
        paid_at=datetime.utcnow(),
    )
    db.add(settlement)
    db.commit()
    db.refresh(settlement)
    return settlement


@router.get("/{group_id}/settlements", response_model=List[SettlementOut])
def list_settlements(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    assert_group_member(group_id, current_user, db)
    return db.query(Settlement).filter(Settlement.group_id == group_id).order_by(Settlement.created_at.desc()).all()
