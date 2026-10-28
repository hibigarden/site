# how fast a sunflower grows

*draft for the second year project. six plants on the back fence, sown on the first of may.*

## abstract

i measured six sunflowers every twenty days from sowing and fitted a logistic curve to their mean height. they follow it closely: slow for the first month, fastest at the end of june, and levelling off near 2.4 m.

## model

let $h(t)$ be the height in metres on day $t$ after sowing. logistic growth says the rate is proportional both to the height and to the room left to grow:

$$
\frac{dh}{dt} = r\,h\left(1 - \frac{h}{K}\right)
$$

which has the solution

$$
h(t) = \frac{K}{1 + e^{-r(t - t_0)}}
$$

here $K$ is the final height, $r$ the growth rate, and $t_0$ the day of fastest growth, when $h = K/2$. on that day the plant grows $rK/4$ metres.

## results

| day | measured (m) | model (m) |
| --- | ------------ | --------- |
| 20  | 0.07         | 0.06      |
| 40  | 0.36         | 0.34      |
| 60  | 1.15         | 1.20      |
| 80  | 2.02         | 2.06      |
| 100 | 2.31         | 2.34      |

the fit gives $K = 2.4$ m, $r = 0.09$ per day and $t_0 = 60$, so the fastest growth was $0.09 \times 2.4 / 4 \approx 5.4$ cm a day, on the thirtieth of june.

## next

- [ ] fit $K$ for each plant instead of the mean
- [ ] count the seed spirals on the same heads, see [[golden angle]]
- [ ] add the sources from the [[reading list]]
