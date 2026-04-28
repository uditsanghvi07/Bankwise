from typing import Literal

from pydantic import BaseModel, Field, field_validator


class EMIRequest(BaseModel):
    principal: float = Field(..., gt=0)
    annual_rate: float = Field(..., ge=1, le=50)
    tenure_months: int = Field(..., ge=1, le=360)
    prepayment_amount: float | None = Field(default=None, ge=0)
    prepayment_after_month: int | None = Field(default=None, ge=1)


class EligibilityRequest(BaseModel):
    monthly_income: float = Field(..., gt=0)
    existing_emi_obligations: float = Field(default=0, ge=0)
    loan_type: Literal["home", "personal", "car", "business"]
    annual_rate: float = Field(..., ge=1, le=50)
    requested_tenure_months: int = Field(..., ge=1, le=360)
    requested_principal: float | None = Field(default=None, gt=0)


class LoanOption(BaseModel):
    label: str
    principal: float = Field(..., gt=0)
    annual_rate: float = Field(..., ge=1, le=50)
    tenure_months: int = Field(..., ge=1, le=360)


class CompareRequest(BaseModel):
    loans: list[LoanOption] = Field(..., min_length=2, max_length=3)


class SIPRequest(BaseModel):
    monthly_sip: float = Field(..., gt=0)
    annual_rate: float = Field(..., ge=0, le=50)
    tenure_years: int = Field(..., ge=1, le=40)


class FDRequest(BaseModel):
    principal: float = Field(..., gt=0)
    annual_rate: float = Field(..., ge=1, le=50)
    tenure_years: float = Field(..., gt=0, le=50)
    compounding_frequency: Literal[1, 4, 12]
    senior_citizen: bool = False


class CibilAction(BaseModel):
    action: str
    impact: int | None = None


class CibilRequest(BaseModel):
    current_score: int = Field(..., ge=300, le=900)
    actions: list[CibilAction] = Field(default_factory=list)

    @field_validator("actions")
    @classmethod
    def limit_actions(cls, v: list[CibilAction]) -> list[CibilAction]:
        if len(v) > 20:
            raise ValueError("Too many actions")
        return v
