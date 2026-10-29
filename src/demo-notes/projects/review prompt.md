# review prompt

what i paste into the agent before it reviews a change to the timer. it reads [[AGENTS]] first.

> review this change to `watering.py` as if it will run in the shed tomorrow at six, with nobody awake to stop it.
>
> 1. does the lavender bed still get 0 litres in every case?
> 2. what does each bed get with 0, 4.9, 5 and 30 mm of rain?
> 3. can any bed get more water than it does on a dry morning?
> 4. what happens when the gauge sends a bad reading, like a negative number?
>
> list the problems first, then what you would change, then a one line verdict.

the last review found that a negative reading gives the beds more water than a dry morning. the fix is still on my list.
