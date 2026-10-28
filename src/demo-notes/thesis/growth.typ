#set page(paper: "a5", margin: 18mm)
#set text(size: 10pt)
#set par(justify: true)
#set heading(numbering: "1.")
#set figure(supplement: [table])

#align(center)[
  #text(size: 16pt)[how fast a sunflower grows]

  #emph[draft for the second year project. six plants on the back fence, sown on the first of may.]
]

= abstract

i measured six sunflowers every twenty days from sowing and fitted a logistic curve to their mean height. they follow it closely: slow for the first month, fastest at the end of june, and levelling off near 2.4 m.

= model

let $h(t)$ be the height in metres on day $t$ after sowing. logistic growth says the rate is proportional both to the height and to the room left to grow:

$ (d h) / (d t) = r h (1 - h / K) $

which has the solution

$ h(t) = K / (1 + e^(-r (t - t_0))) $

here $K$ is the final height, $r$ the growth rate, and $t_0$ the day of fastest growth, when $h = K\/2$. on that day the plant grows $r K\/4$ metres.

= results

#figure(
  table(
    columns: 3,
    align: (left, right, right),
    table.header([day], [measured (m)], [model (m)]),
    [20], [0.07], [0.06],
    [40], [0.36], [0.34],
    [60], [1.15], [1.20],
    [80], [2.02], [2.06],
    [100], [2.31], [2.34],
  ),
  caption: [mean height of the six plants against the fitted curve.],
)

the fit gives $K = 2.4$ m, $r = 0.09$ per day and $t_0 = 60$, so the fastest growth was $0.09 times 2.4 \/ 4 approx 5.4$ cm a day, on the thirtieth of june.

