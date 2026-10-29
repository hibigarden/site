# watering

the drip timer in the shed clicks on at six every morning. this script decides how much each bed gets from the rain gauge reading. the setup is drawn in [[drip setup]] and the beds are in the [[planting plan]].

```python
from datetime import time

START = time(6, 0)  # the drip timer clicks on at six

# litres per bed on a dry morning
LITRES = {
    "lavender bed": 0.0,  # lavender likes it dry
    "sunflowers": 2.0,
    "sweet peas": 3.0,
    "apple tree": 4.0,
}


def litres_for(bed: str, rain_mm: float) -> float:
    """water for one bed after rain_mm of rain since midnight."""
    if rain_mm >= 5:
        return 0.0
    # each millimetre of rain saves a fifth of the water
    return round(LITRES[bed] * (1 - rain_mm / 5), 2)


if __name__ == "__main__":
    for bed in LITRES:
        print(f"{START:%H:%M} {bed}: {litres_for(bed, rain_mm=2)} l")
```

after 2 mm of rain, `python3 watering.py` prints:

```text
06:00 lavender bed: 0.0 l
06:00 sunflowers: 1.2 l
06:00 sweet peas: 1.8 l
06:00 apple tree: 2.4 l
```
