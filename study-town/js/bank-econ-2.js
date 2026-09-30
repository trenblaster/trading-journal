// Extra Economics 9708 questions (AS topics 1–2), written in the style of Paper 1 and Paper 2.
(function () {
  const S = 'econ';
  const M = (topic, q, options, answer, explain) => Bank.add(S, { type: 'mcq', topic, q, options, answer, explain, papers: [1] });
  const G = (topic, graph, q, options, answer, explain) => Bank.add(S, { type: 'mcq', topic, graph, q, options, answer, explain, papers: [1, 2] });
  const P2 = (topic, prompt, points, model) => Bank.add(S, { type: 'self', topic, prompt, points, model, papers: [2] });
  const tbl = (head, rows) => `<table class="qt"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  // 1.1 Scarcity, choice and opportunity cost
  M('1.1', 'A government uses land to build a hospital instead of a school. What is the opportunity cost of the hospital?',
    ['The school that could have been built', 'The money spent on the hospital', 'The wages of hospital staff', 'The tax raised to pay for it'], 0,
    'Opportunity cost is measured in terms of the next best alternative forgone, not in money.');
  M('1.1', 'Why does scarcity exist in all economies, both rich and poor?',
    ['Wants are unlimited relative to the resources available', 'Governments restrict production', 'Prices are too high', 'Some people are unemployed'], 0,
    'Even rich economies face finite resources relative to unlimited wants, so choices are always needed.');
  M('1.1', 'Which question is NOT one of the basic economic questions every economy must answer?',
    ['What price should the government charge for bread?', 'What should be produced?', 'How should it be produced?', 'For whom should it be produced?'], 0,
    'The three fundamental questions are what, how and for whom. Setting a price is one possible method, not a basic question.');
  M('1.1', 'A farmer can grow either 100 tonnes of rice or 60 tonnes of maize on a field. What is the opportunity cost of 1 tonne of maize?',
    ['1⅔ tonnes of rice', '0.6 tonnes of rice', '60 tonnes of rice', '100 tonnes of rice'], 0,
    '60 maize costs 100 rice, so 1 maize costs 100 ÷ 60 = 1⅔ rice.');
  M('1.1', 'Which is the best example of a decision made at the margin?',
    ['A café deciding whether to stay open for one more hour', 'A country deciding to change its economic system', 'A student choosing a university', 'A firm deciding which country to locate in'], 0,
    'Marginal decisions compare the extra benefit and extra cost of a small, incremental change.');

  // 1.2 Economic methodology
  M('1.2', 'Which statement is positive?',
    ['An increase in tobacco tax will reduce smoking', 'Tobacco should be banned', 'The government ought to tax tobacco more', 'It is unfair to tax smokers heavily'], 0,
    'Positive statements can be tested with evidence. The others contain value judgements.');
  M('1.2', 'Economists often build models that simplify reality. What is the main reason?',
    ['To isolate the key relationships between variables', 'To make predictions that are always accurate', 'To avoid using data', 'To replace value judgements'], 0,
    'Models make assumptions (such as ceteris paribus) so that key relationships can be analysed. They are not always accurate.');
  M('1.2', 'In the very long run, which can change?',
    ['Technology and all factors of production', 'Only labour', 'Only capital', 'Nothing can change'], 0,
    'Short run: at least one fixed factor. Long run: all factors variable. Very long run: technology and the wider environment can change too.');
  M('1.2', 'Two economists agree on all the evidence about a minimum wage but disagree about whether it should be raised. Why?',
    ['They hold different value judgements', 'One of them is using a positive statement incorrectly', 'The evidence is normative', 'Ceteris paribus does not apply'], 0,
    'Disagreement about what should happen, even with the same facts, comes from different values: a normative disagreement.');

  // 1.3 Factors of production
  M('1.3', 'Which is an example of land as a factor of production?',
    ['Fish in the sea', 'A fishing boat', 'A fisherman', 'The owner of a fishing company'], 0,
    'Land includes all natural resources. The boat is capital, the fisherman labour, the owner enterprise.');
  M('1.3', 'Which is a function of the entrepreneur?',
    ['Organising the other factors and bearing risk', 'Providing labour only', 'Lending money to the firm', 'Supplying natural resources'], 0,
    'Entrepreneurs combine land, labour and capital, make decisions and take risks in return for profit.');
  M('1.3', 'Which would increase the quantity of labour available in an economy?',
    ['A rise in the retirement age', 'A fall in the birth rate 5 years ago', 'An increase in the school leaving age', 'Emigration of skilled workers'], 0,
    'A higher retirement age keeps more people in the labour force. The others reduce labour supply.');
  M('1.3', 'Specialisation between countries and individuals depends on',
    ['the ability to exchange goods through trade or money', 'every worker having the same skills', 'a planned economy', 'the absence of capital'], 0,
    'People only specialise if they can exchange their output for other goods, which money and markets make easier.');
  M('1.3', 'A car factory introduces robots that replace many assembly-line workers. The robots are an increase in',
    ['capital, substituting for labour', 'land', 'enterprise', 'labour productivity only, with no change in capital'], 0,
    'Robots are man-made aids to production (capital). The factory has made its production more capital-intensive.');

  // 1.4 Resource allocation in different economic systems
  M('1.4', 'In a market economy, what mainly determines which goods are produced?',
    ['Consumer demand expressed through prices', 'Government plans', 'Tradition', 'The number of workers'], 0,
    'Consumer sovereignty: producers respond to price signals and profit.');
  M('1.4', 'Which is a likely problem of a planned economy?',
    ['Shortages and surpluses because planners lack information', 'Too much inequality', 'Under-provision of public goods', 'Excessive advertising'], 0,
    'Central planners cannot gather all the information prices provide, leading to mismatches between supply and demand and weak incentives.');
  M('1.4', 'The demand for electric cars rises. How does the price mechanism reallocate resources?',
    ['Higher prices and profits attract resources into electric car production', 'The government orders more factories', 'Consumers are rationed by queues', 'Resources move to petrol cars'], 0,
    'Prices signal a change in preferences, give incentives to producers, and ration the available cars.');
  M('1.4', 'Which is a key feature of a free market economy?',
    ['Private ownership of resources', 'State ownership of most firms', 'Prices set by the government', 'No consumer choice'], 0,
    'Private property, the profit motive, competition and prices allocating resources.');
  M('1.4', 'Transition from a planned to a market economy is most likely to involve',
    ['privatisation of state-owned firms', 'nationalisation of private firms', 'more price controls', 'fewer private property rights'], 0,
    'Transition economies transfer ownership to the private sector and let prices be set by markets.');

  // 1.5 Production possibility curves
  M('1.5', 'A straight-line PPC shows that',
    ['opportunity cost is constant', 'opportunity cost is rising', 'resources are unemployed', 'there is no scarcity'], 0,
    'A constant slope means each extra unit of one good always costs the same amount of the other.');
  M('1.5', 'An economy producing on its PPC decides to produce more capital goods. What is the most likely long-run effect?',
    ['The PPC shifts outwards', 'The PPC shifts inwards', 'The economy moves inside the PPC', 'There is no effect'], 0,
    'More capital goods today increase productive capacity in future: economic growth. The short-run cost is fewer consumer goods.');
  M('1.5', 'A natural disaster destroys factories and roads. How is this shown on a PPC?',
    ['An inward shift of the PPC', 'A movement along the PPC', 'An outward shift', 'A movement from inside to on the PPC'], 0,
    'A loss of resources reduces productive capacity, so the maximum possible output falls.');
  M('1.5', 'New technology raises productivity in producing cars but not in producing food. How does the PPC change?',
    ['It pivots outwards along the car axis only', 'It shifts outwards parallel', 'It shifts inwards', 'It pivots outwards along the food axis only'], 0,
    'Only the maximum output of cars increases, so the PPC pivots out on the car axis; the food intercept stays the same.');
  G('1.5', { type: 'ppc' }, 'Which point on the diagram is currently unattainable?',
    ['C', 'A', 'B', 'D'], 0,
    'C lies outside the PPC: it cannot be produced with current resources and technology.');

  // 1.6 Classification of goods and services
  M('1.6', 'Why might a merit good be under-consumed in a free market?',
    ['Consumers underestimate its benefits to themselves', 'It is non-excludable', 'It is too cheap', 'It has no opportunity cost'], 0,
    'Information failure: people do not fully appreciate the private benefits (e.g. of education or vaccination).');
  M('1.6', 'A lighthouse is often given as an example of a public good because',
    ['one ship using it does not reduce its use by others, and ships cannot be excluded', 'it is provided by a private firm', 'it is a merit good', 'it is rival in consumption'], 0,
    'Non-rivalry and non-excludability create a free-rider problem.');
  M('1.6', 'Which is a private good?',
    ['A sandwich', 'National defence', 'Street lighting', 'A flood barrier'], 0,
    'Private goods are rival and excludable.');
  M('1.6', 'Which statement about demerit goods is correct?',
    ['The market price does not reflect the full harm to the consumer, so they are over-consumed', 'They are always illegal', 'They are non-rival', 'They are under-provided by the market'], 0,
    'Consumers underestimate the harm (information failure), so consumption is higher than it would be with full information.');

  // 2.1 Demand and supply curves
  M('2.1', 'Which would cause the demand curve for tea to shift to the right?',
    ['A rise in the price of coffee', 'A fall in the price of tea', 'A rise in the cost of producing tea', 'A fall in the price of coffee'], 0,
    'Coffee is a substitute. When coffee becomes dearer, demand for tea increases at every price.');
  M('2.1', 'An effective demand for a good means that consumers are',
    ['willing and able to pay for it', 'wishing to buy it', 'able to afford it', 'buying it at any price'], 0,
    'Effective demand is desire backed by the ability to pay.');
  M('2.1', 'Which would cause a movement along the supply curve for oil?',
    ['A change in the price of oil', 'New drilling technology', 'A tax on oil producers', 'A fall in the cost of labour'], 0,
    'Only a change in the good\'s own price moves along its supply curve; the others shift it.');
  M('2.1', 'Individual demand curves are added together to find market demand. How?',
    ['Adding quantities demanded at each price (horizontal summation)', 'Adding prices at each quantity', 'Averaging the curves', 'Multiplying quantities'], 0,
    'Market demand is the horizontal sum of individual demand curves.');
  M('2.1', 'A new firm enters a market. What happens to market supply?',
    ['It shifts to the right', 'It shifts to the left', 'There is a movement along it', 'Nothing'], 0,
    'More producers means more is supplied at every price.');
  M('2.1', 'Why does a supply curve normally slope upwards?',
    ['Higher prices make production more profitable and cover rising costs', 'Consumers buy more at higher prices', 'Costs fall as output rises', 'Firms are forced to supply more'], 0,
    'A higher price gives an incentive to supply more and allows firms to cover the higher marginal costs of extra output.');

  // 2.2 PED, YED, XED
  M('2.2', 'A firm cuts its price and total revenue rises. Demand is',
    ['price elastic', 'price inelastic', 'unit elastic', 'perfectly inelastic'], 0,
    'If revenue rises when price falls, the percentage rise in quantity exceeds the percentage fall in price: |PED| > 1.');
  M('2.2', 'Demand for a product has a PED of zero. The demand curve is',
    ['vertical', 'horizontal', 'a rectangular hyperbola', 'upward sloping'], 0,
    'Perfectly inelastic demand: quantity does not change whatever the price.');
  M('2.2', `The table shows how demand for good X changes when income rises.<br>${tbl(['', 'Year 1', 'Year 2'], [['Average income ($)', '20 000', '22 000'], ['Quantity of X', '500', '450']])}What type of good is X?`,
    ['Inferior', 'Luxury', 'Normal necessity', 'Complement'], 0,
    'Income rose 10% and demand fell 10%, so YED = -1. Negative YED means X is an inferior good.');
  M('2.2', 'A rise in the price of printers causes demand for printer ink to fall. The XED between ink and printers is',
    ['negative, so they are complements', 'positive, so they are substitutes', 'zero', 'greater than one'], 0,
    'The price of one rises and demand for the other falls: negative XED, complements.');
  M('2.2', 'Why is knowledge of PED useful to a government?',
    ['To predict the effect of an indirect tax on tax revenue and consumption', 'To decide on the exchange rate', 'To measure inflation', 'To calculate GDP'], 0,
    'Taxes on goods with inelastic demand raise more revenue but reduce consumption less.');
  M('2.2', 'Which good is likely to have the most price elastic demand?',
    ['One particular brand of toothpaste', 'Toothpaste in general', 'Tap water', 'Insulin'], 0,
    'A single brand has many close substitutes, so consumers switch easily when its price rises.');
  M('2.2', 'Demand for a product becomes more price elastic over time because',
    ['consumers have time to find substitutes', 'incomes fall', 'the product becomes a necessity', 'supply becomes inelastic'], 0,
    'In the long run people can change habits and discover alternatives.');

  // 2.3 PES
  M('2.3', 'Why is the supply of fresh flowers price inelastic in the short run?',
    ['They take time to grow and cannot be stored for long', 'Demand is inelastic', 'There are many producers', 'They are cheap to produce'], 0,
    'Long production periods and perishability make it hard to respond quickly to a price rise.');
  M('2.3', 'PES is greater than 1. What does this mean?',
    ['Quantity supplied changes by a larger percentage than price', 'Price changes by more than quantity supplied', 'Supply does not respond to price', 'Supply falls when price rises'], 0,
    'Elastic supply: producers are very responsive to price changes.');
  M('2.3', 'A supply curve is horizontal. PES is',
    ['infinite (perfectly elastic)', 'zero', 'one', 'negative'], 0,
    'Any amount is supplied at the given price; a tiny price fall reduces supply to zero.');
  M('2.3', 'Which would make supply of a manufactured good more elastic?',
    ['Large stocks of finished goods held in warehouses', 'Factories working at full capacity', 'A shortage of skilled labour', 'A long production process'], 0,
    'Firms can release stocks quickly when price rises.');

  // 2.4 Interaction of demand and supply
  M('2.4', 'Demand and supply both increase, but supply increases by more. What happens?',
    ['Quantity rises and price falls', 'Quantity rises and price rises', 'Quantity falls and price rises', 'Price and quantity are unchanged'], 0,
    'Both shifts raise quantity. The larger supply increase pushes price down overall.');
  M('2.4', 'A frost destroys much of the orange crop. At the same time, a report says orange juice is very healthy. What happens to the price of oranges?',
    ['It definitely rises', 'It definitely falls', 'It is unchanged', 'The effect cannot be predicted'], 0,
    'Supply falls (price up) and demand rises (price up), so price definitely rises. The effect on quantity is uncertain.');
  M('2.4', 'Petrol and diesel are alternative fuels for which demand is competitive. The price of petrol rises. What happens in the diesel market?',
    ['Demand for diesel increases, raising its price', 'Supply of diesel falls', 'Demand for diesel falls', 'Nothing'], 0,
    'Competitive (alternative) demand: substitutes. A higher petrol price switches demand to diesel.');
  M('2.4', 'The wage rate of builders rises because demand for new houses increases. This illustrates',
    ['derived demand', 'joint supply', 'competitive supply', 'composite demand'], 0,
    'The demand for builders is derived from the demand for the houses they build.');
  G('2.4', { type: 'shift', shift: 'D', dir: 'left' }, 'The diagram shows a shift in demand from D to D1. Which could cause it for a normal good?',
    ['A fall in consumers\' incomes', 'A fall in the price of the good', 'A fall in the cost of raw materials', 'An improvement in technology'], 0,
    'Lower income reduces demand for a normal good: D shifts left, price and quantity fall.');
  G('2.4', { type: 'shift', shift: 'D', dir: 'right' }, 'Before the shift, at price P0 what happens once demand shifts to D1?',
    ['Excess demand pushes the price up to P1', 'Excess supply pushes price down', 'Nothing, since P0 is still equilibrium', 'Supply shifts to the right'], 0,
    'At P0 quantity demanded on D1 exceeds quantity supplied. The shortage bids price up to the new equilibrium E1.');

  // 2.5 Consumer and producer surplus
  M('2.5', 'A consumer is willing to pay $50 for a concert ticket and pays $35. What is the consumer surplus?',
    ['$15', '$35', '$50', '$85'], 0,
    'Consumer surplus = willingness to pay - price paid = $50 - $35.');
  M('2.5', 'Producer surplus is the difference between',
    ['the price received and the minimum price a producer would accept', 'total revenue and profit', 'price and consumer surplus', 'demand and supply'], 0,
    'It is the area above the supply curve and below the price.');
  M('2.5', 'A maximum price is set below equilibrium. What happens to producer surplus?',
    ['It falls', 'It rises', 'It is unchanged', 'It becomes consumer surplus entirely'], 0,
    'Producers receive a lower price and sell a smaller quantity, so producer surplus falls.');
  G('2.5', { type: 'surplus' }, 'Demand increases and the equilibrium price rises. What happens to area Y?',
    ['It increases', 'It decreases', 'It is unchanged', 'It becomes area X'], 0,
    'Producer surplus (Y) grows as producers receive a higher price and sell more.');

  // Paper 2 style
  P2('2.1', `<b>Data response (style).</b> Global coffee prices rose 40% in a year after drought in Brazil. At the same time, demand grew in Asia.<br><br>(a) Using a demand and supply diagram, explain how these two events could cause the price rise. [4]<br>(b) Explain one reason why supply of coffee may be price inelastic in the short run. [2]`,
    ['(a) Supply shifts left because of the drought (fewer beans harvested)', '(a) Demand shifts right because of rising demand in Asia', '(a) Correctly labelled diagram: axes, D, S, shifts, new higher price', '(b) Coffee takes years to grow / new plants take time, so output cannot respond quickly'],
    null);
  P2('2.5', `<b>Essay.</b> (a) Explain what is meant by consumer surplus and producer surplus, using a diagram. [8]<br>(b) Discuss whether a maximum price on rented housing will benefit tenants. [12]`,
    ['(a) Definitions of both surpluses', '(a) Accurate diagram with areas labelled', '(a) Explain how the areas change with price', '(b) Maximum price below equilibrium: lower rent for those who find housing (gain in consumer surplus)', '(b) Shortage: excess demand, queues, some tenants cannot find housing', '(b) Landlords may cut maintenance, black markets / key money', '(b) Effect depends on elasticity and enforcement', '(b) Supported conclusion'],
    null);
})();
