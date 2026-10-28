# watering

the drip timer runs this every morning at six.

```python
litres = {"lavender": 0, "sunflowers": 2, "sweet peas": 3}

def water(bed, rain_mm):
    # a wet night waters everything
    if rain_mm > 5:
        return 0
    return litres[bed]
```
