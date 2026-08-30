from decimal import Decimal, ROUND_HALF_UP

TWOPLACES = Decimal("0.01")


def as_money(value: Decimal | int | str | float | None) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def money_str(value: Decimal | int | str | float | None) -> str:
    return f"{as_money(value):.2f}"
