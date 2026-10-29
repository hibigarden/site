# AGENTS.md

notes for an ai coding agent working on the drip timer. the code runs on a raspberry pi in the shed, and the current script is in [[watering]].

## the project

- `watering.py` decides how many litres each bed gets when the timer clicks on at six.
- the rain gauge reports millimetres of rain since midnight.
- the pipes and the valve are drawn in [[drip setup]].

## rules

- the lavender bed by the gate gets 0 litres, always. it has no drip line and it likes to be dry.
- keep the start at six. the sun is still low and the water butt has filled overnight.
- 5 mm of rain or more skips the morning. less rain cuts the water by a fifth per millimetre.
- python 3 standard library only. the pi has no internet in the shed.
- run `python3 watering.py` after every change and put the output in your reply.

## before you finish

- explain each change in one sentence.
- ask before touching the valve wiring or the timer schedule.
