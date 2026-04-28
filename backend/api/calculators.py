from fastapi import APIRouter
from pydantic import ValidationError

from calculators import cibil as cibil_calc
from calculators import comparison as comparison_calc
from calculators import eligibility as eligibility_calc
from calculators import emi as emi_calc
from calculators import investment as investment_calc
from schemas.calculator_schemas import (
    CibilRequest,
    CompareRequest,
    EligibilityRequest,
    EMIRequest,
    FDRequest,
    SIPRequest,
)

router = APIRouter(prefix="/calculate", tags=["calculators"])


def _validation_errors(exc: ValidationError) -> list[dict]:
    return [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]


@router.post("/emi")
async def calculate_emi(body: dict):
    try:
        req = EMIRequest.model_validate(body)
    except ValidationError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=_validation_errors(e)) from e
    result = emi_calc.amortization_schedule(
        req.principal,
        req.annual_rate,
        req.tenure_months,
        prepayment_amount=req.prepayment_amount,
        prepayment_after_month=req.prepayment_after_month,
    )
    return result


@router.post("/eligibility")
async def calculate_eligibility(body: dict):
    try:
        req = EligibilityRequest.model_validate(body)
    except ValidationError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=_validation_errors(e)) from e
    return eligibility_calc.compute_eligibility(
        req.monthly_income,
        req.existing_emi_obligations,
        req.loan_type,
        req.annual_rate,
        req.requested_tenure_months,
        requested_principal=req.requested_principal,
    )


@router.post("/compare")
async def calculate_compare(body: dict):
    try:
        req = CompareRequest.model_validate(body)
    except ValidationError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=_validation_errors(e)) from e
    loans = [loan.model_dump() for loan in req.loans]
    return comparison_calc.compare_loans(loans)


@router.post("/sip")
async def calculate_sip(body: dict):
    try:
        req = SIPRequest.model_validate(body)
    except ValidationError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=_validation_errors(e)) from e
    return investment_calc.sip_maturity(req.monthly_sip, req.annual_rate, req.tenure_years)


@router.post("/fd")
async def calculate_fd(body: dict):
    try:
        req = FDRequest.model_validate(body)
    except ValidationError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=_validation_errors(e)) from e
    return investment_calc.fd_maturity(
        req.principal,
        req.annual_rate,
        int(req.tenure_years),
        req.compounding_frequency,
        senior_citizen=req.senior_citizen,
    )


@router.post("/cibil")
async def calculate_cibil(body: dict):
    try:
        req = CibilRequest.model_validate(body)
    except ValidationError as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=_validation_errors(e)) from e
    actions = [a.model_dump() for a in req.actions]
    return cibil_calc.simulate(req.current_score, actions)
