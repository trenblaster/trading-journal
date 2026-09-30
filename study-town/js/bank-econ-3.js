// Extra Economics 9708 questions (AS topics 3–6), written in the style of Paper 1 and Paper 2.
(function () {
  const S = 'econ';
  const M = (topic, q, options, answer, explain) => Bank.add(S, { type: 'mcq', topic, q, options, answer, explain, papers: [1] });
  const G = (topic, graph, q, options, answer, explain) => Bank.add(S, { type: 'mcq', topic, graph, q, options, answer, explain, papers: [1, 2] });
  const P2 = (topic, prompt, points, model) => Bank.add(S, { type: 'self', topic, prompt, points, model, papers: [2] });
  const tbl = (head, rows) => `<table class="qt"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  // 3.1 Reasons for intervention
  M('3.1', 'Which is an example of information failure?',
    ['Consumers do not realise the long-term health damage of sugary drinks', 'A firm raises its price', 'A government taxes cigarettes', 'Wages rise in a shortage'], 0,
    'Imperfect information leads consumers to make choices that do not maximise their own welfare.');
  M('3.1', 'Governments may intervene to redistribute income because',
    ['a free market can produce an unequal distribution that society sees as unfair', 'markets always produce equal incomes', 'public goods are over-provided', 'prices are always too low'], 0,
    'Equity is a reason for intervention alongside efficiency (correcting market failure).');
  M('3.1', 'A private firm will not provide street lighting because',
    ['it cannot charge the people who benefit, so it cannot make a profit', 'street lighting is a demerit good', 'demand is too elastic', 'it is rival in consumption'], 0,
    'Non-excludability creates the free-rider problem, so the market is missing.');
  M('3.1', 'Which is NOT normally a reason for government intervention in a market?',
    ['A market where supply and demand clear with no market failure', 'Over-consumption of a demerit good', 'Under-provision of a public good', 'Large inequality of income'], 0,
    'If there is no market failure or equity concern, intervention is not justified on efficiency grounds.');

  // 3.2 Methods and effects
  M('3.2', 'The government gives a subsidy to producers of vaccines. What is the most likely effect?',
    ['Supply increases, price falls and consumption rises', 'Demand falls', 'Price rises', 'A shortage appears'], 0,
    'A subsidy lowers costs, shifting supply right. Lower price increases consumption of the merit good.');
  M('3.2', 'An indirect tax is imposed on a good with perfectly elastic supply. Who pays the tax?',
    ['Consumers pay all of it', 'Producers pay all of it', 'It is shared equally', 'The government'], 0,
    'With perfectly elastic (horizontal) supply, price rises by the full tax, so the burden falls on consumers.');
  M('3.2', 'Which is an ad valorem tax?',
    ['A 15% sales tax', 'A $2 tax per litre of fuel', 'A fixed licence fee', 'A tax of $5 per packet of cigarettes'], 0,
    'Ad valorem taxes are a percentage of the price. Specific taxes are a fixed amount per unit.');
  M('3.2', 'A government bans the sale of a harmful drug. Which is a likely unintended consequence?',
    ['An illegal (black) market develops', 'Consumption rises legally', 'Tax revenue increases', 'The price falls to zero'], 0,
    'Prohibition can push trade underground, with no tax revenue and no safety regulation.');
  M('3.2', 'Why might a government provide a merit good directly and free of charge?',
    ['To ensure consumption is not limited by ability to pay', 'Because it has no opportunity cost', 'Because demand is zero', 'Because it is non-rival'], 0,
    'Free provision raises consumption towards the socially desirable level and improves equity, but must be funded from taxes.');
  M('3.2', 'Which is an example of government failure?',
    ['A subsidy costs more than the benefits it creates', 'A market produces too few public goods', 'Firms respond to price signals', 'Consumers buy less at higher prices'], 0,
    'Government failure happens when intervention leads to a worse allocation of resources than before.');
  M('3.2', 'A buffer stock scheme for a crop aims to',
    ['keep the price within a target range by buying in good harvests and selling in bad ones', 'raise the price permanently', 'eliminate all farm output', 'tax farmers'], 0,
    'The agency buys surplus when supply is high and releases stock when supply is low, stabilising prices and incomes.');
  G('3.2', { type: 'priceControl', kind: 'max' }, 'Which is most likely to happen after the maximum price shown is introduced?',
    ['Queues and black markets', 'Stockpiles of unsold goods', 'Higher producer surplus', 'Quantity traded rises to Qd'], 0,
    'Only Qs is supplied. Excess demand leads to rationing: queues, waiting lists or illegal trading at higher prices.');
  G('3.2', { type: 'tax' }, 'How much tax per unit is shown in the diagram?',
    ['P1 - P2', 'P1 - P0', 'P0 - P2', 'Q0 - Q1'], 0,
    'The vertical distance between S and S+tax equals the tax per unit: the gap between the price consumers pay (P1) and the price producers receive (P2).');

  // 3.3 Inequality
  M('3.3', 'Which is a regressive tax?',
    ['A tax that takes a higher proportion of income from low earners than from high earners', 'A tax on high incomes only', 'A tax that takes the same proportion from everyone', 'A tax that rises in % as income rises'], 0,
    'Taxes on spending are often regressive because poorer households spend a larger share of income.');
  M('3.3', 'Which policy is most likely to reduce income inequality?',
    ['Means-tested benefits for low-income households', 'Cutting the top rate of income tax', 'Raising sales taxes on food', 'Reducing the minimum wage'], 0,
    'Means-tested (targeted) benefits transfer income to poorer households.');
  M('3.3', 'A universal benefit is one that is',
    ['paid to everyone in a group regardless of income', 'paid only to those on low incomes', 'a tax on the rich', 'paid only to the unemployed'], 0,
    'E.g. a state pension for all people over a certain age. Means-tested benefits depend on income or wealth.');
  M('3.3', 'A national minimum wage is introduced above the equilibrium wage. What might happen?',
    ['Low-paid workers in work earn more, but some jobs may be lost', 'Unemployment definitely falls', 'All workers earn the same', 'The labour market is unaffected'], 0,
    'A wage floor above equilibrium raises pay for those employed but may create excess supply of labour (unemployment).');
  G('3.3', { type: 'lorenz' }, 'If income became perfectly equally distributed, what would happen to area A?',
    ['It would shrink to zero', 'It would equal area B', 'It would grow', 'No change'], 0,
    'The Lorenz curve would lie on the line of equality, so A = 0 and the Gini coefficient = 0.');

  // 4.1 National income statistics
  M('4.1', 'Which is included in GDP?',
    ['Cars produced in the country by a foreign-owned firm', 'Second-hand cars sold', 'Transfer payments such as pensions', 'Income earned abroad by residents'], 0,
    'GDP measures output produced within the country\'s borders, whoever owns the firm. Transfers and second-hand sales are excluded.');
  M('4.1', 'Why is real GDP per head a better measure of living standards than nominal GDP?',
    ['It removes the effect of inflation and population size', 'It includes the value of leisure', 'It measures income inequality', 'It includes the informal economy'], 0,
    'Real figures remove price changes; per head adjusts for population.');
  M('4.1', 'Which is a limitation of using GDP to compare living standards between countries?',
    ['It ignores the informal economy and income distribution', 'It is measured in money', 'It includes all services', 'It is adjusted for inflation'], 0,
    'GDP excludes unrecorded activity, ignores inequality, environmental costs and quality of life. Exchange rates also distort comparisons.');
  M('4.1', `The data show national income figures ($bn). ${tbl(['', '$bn'], [['GDP', '500'], ['Net income from abroad', '-20'], ['Depreciation', '40']])}What is NNI?`,
    ['$440bn', '$480bn', '$460bn', '$520bn'], 0,
    'GNI = 500 - 20 = 480. NNI = GNI - depreciation = 480 - 40 = 440.');

  // 4.2 Circular flow
  M('4.2', 'In a simple two-sector circular flow, households provide',
    ['factor services to firms in return for income', 'goods to firms', 'taxes to firms', 'investment to government'], 0,
    'Households supply factors of production; firms pay them incomes, which households spend on goods and services.');
  M('4.2', 'Which is a withdrawal (leakage) from the circular flow?',
    ['Spending on imports', 'Government spending', 'Exports', 'Investment'], 0,
    'Withdrawals are savings, taxes and imports. They take income out of the domestic flow.');
  M('4.2', 'Households decide to save a larger proportion of their income. Other things equal, what happens to national income?',
    ['It falls, because withdrawals rise', 'It rises', 'It is unchanged', 'It rises because banks lend more'], 0,
    'Higher saving reduces consumption, so spending in the flow falls until withdrawals equal injections again.');
  M('4.2', 'Equilibrium national income occurs when',
    ['total injections equal total withdrawals', 'exports equal imports', 'government spending equals taxation', 'saving equals zero'], 0,
    'Each pair need not balance individually; only the totals must.');

  // 4.3 AD/AS
  M('4.3', 'Which would shift the AS curve to the right?',
    ['An increase in labour productivity', 'An increase in wages with no change in productivity', 'A rise in import prices', 'A rise in business taxes'], 0,
    'Higher productivity lowers costs per unit and increases productive capacity.');
  M('4.3', 'A fall in the exchange rate is most likely to shift',
    ['AD to the right, as exports rise and imports fall', 'AD to the left', 'AS to the right', 'nothing'], 0,
    'Exports become more competitive and imports dearer, raising net exports (X - M).');
  M('4.3', 'Business confidence falls sharply. What is the likely effect?',
    ['Investment falls, shifting AD to the left', 'AS shifts to the right', 'AD shifts to the right', 'The price level rises'], 0,
    'Investment depends heavily on expectations. Lower I reduces AD, cutting real output and putting downward pressure on prices.');
  G('4.3', { type: 'adas', shift: 'AD', dir: 'left' }, 'The diagram shows AD falling to AD1. What happens?',
    ['Real output and the price level both fall', 'Real output rises, price level falls', 'Both rise', 'Only the price level changes'], 0,
    'A fall in AD reduces real output from Y0 to Y1 and the price level from P0 to P1.');
  G('4.3', { type: 'adas', shift: 'AS', dir: 'right' }, 'Which could explain the shift from AS to AS1?',
    ['Improved education raising labour productivity', 'Higher oil prices', 'A rise in consumer confidence', 'A fall in the money supply'], 0,
    'AS increases when costs fall or productive capacity grows: more output at a lower price level.');

  // 4.4 Growth
  M('4.4', 'Which is most likely to cause actual economic growth in the short run?',
    ['A rise in consumer spending when there is spare capacity', 'A fall in investment', 'An increase in unemployment', 'A fall in exports'], 0,
    'With spare capacity, higher AD raises real output: the economy moves towards its PPC.');
  M('4.4', 'Which is a possible cost of rapid economic growth?',
    ['Environmental damage and depletion of resources', 'Higher tax revenue', 'Lower unemployment', 'Higher living standards'], 0,
    'Growth can bring pollution, congestion, inequality and inflationary pressure.');
  M('4.4', 'Real GDP grew by 2% while the population grew by 3%. What happened to real GDP per head?',
    ['It fell by about 1%', 'It rose by about 1%', 'It rose by 5%', 'It was unchanged'], 0,
    'Approximately 2% - 3% = -1%. Output per person fell.');
  M('4.4', 'Sustainable economic growth means growth that',
    ['meets present needs without harming future generations\' ability to meet theirs', 'is always above 5% a year', 'is caused only by exports', 'causes no inflation at all'], 0,
    'Sustainability considers the environment and resources as well as output.');

  // 4.5 Unemployment
  M('4.5', 'Cyclical (demand-deficient) unemployment is caused by',
    ['a fall in aggregate demand, for example in a recession', 'workers changing jobs', 'changes in the structure of industry', 'seasonal changes in demand'], 0,
    'When AD falls, firms need fewer workers across the economy.');
  M('4.5', 'Ski instructors who are out of work in summer are',
    ['seasonally unemployed', 'structurally unemployed', 'cyclically unemployed', 'frictionally unemployed'], 0,
    'Seasonal unemployment follows regular changes in demand over the year.');
  M('4.5', 'Which policy is best suited to reducing structural unemployment?',
    ['Retraining schemes for workers in declining industries', 'Cutting interest rates', 'Raising government spending in general', 'Increasing tariffs'], 0,
    'Structural unemployment is a mismatch of skills or location, which supply-side measures like training target.');
  M('4.5', 'Which is a cost of unemployment to the government?',
    ['Higher spending on benefits and lower tax revenue', 'Higher tax revenue', 'Lower spending on benefits', 'A budget surplus'], 0,
    'Unemployment raises welfare payments and reduces income and spending taxes.');
  M('4.5', 'The claimant count measure of unemployment counts',
    ['people receiving unemployment-related benefits', 'everyone without a job', 'people surveyed who are looking for work', 'students'], 0,
    'The Labour Force Survey (ILO) measure uses a survey of people available and looking for work; it is usually higher than the claimant count.');

  // 4.6 Price stability
  M('4.6', 'Which is most likely to cause cost-push inflation?',
    ['A large rise in the price of imported raw materials', 'A rise in consumer confidence', 'Lower income tax', 'Higher government spending'], 0,
    'Higher costs of production shift AS to the left, pushing up the price level.');
  M('4.6', `A price index rose from 120 to 126. What was the rate of inflation?`,
    ['5%', '6%', '126%', '4.8%'], 0,
    '(126 - 120) ÷ 120 × 100 = 5%.');
  M('4.6', 'Inflation fell from 6% to 3%. What happened to the general price level?',
    ['It rose, but more slowly', 'It fell', 'It stayed the same', 'It halved'], 0,
    'A positive but lower inflation rate means prices are still rising (disinflation), not falling.');
  M('4.6', 'Which group is likely to gain from unexpected inflation?',
    ['Borrowers with fixed-rate loans', 'Savers with fixed interest', 'Pensioners on fixed incomes', 'Lenders'], 0,
    'The real value of what borrowers owe falls.');
  M('4.6', 'Why might high inflation harm a country\'s international competitiveness?',
    ['Its exports become relatively more expensive', 'Its imports become more expensive', 'Its exchange rate must rise', 'Its interest rates fall'], 0,
    'If domestic prices rise faster than trading partners\', exports lose price competitiveness (with a fixed or slow-moving exchange rate).');

  // 5.1 Objectives
  M('5.1', 'Why might a government aim for low and stable inflation rather than zero inflation?',
    ['Deflation can discourage spending and a small positive rate gives flexibility', 'Zero inflation is impossible to measure', 'Inflation always increases growth', 'Zero inflation causes a trade deficit'], 0,
    'Many central banks target around 2% to avoid the risk of deflation.');
  M('5.1', 'Which is a macroeconomic policy objective?',
    ['A sustainable balance of payments position', 'Maximising the profit of state firms', 'Raising the price of houses', 'Increasing imports'], 0,
    'Main objectives: growth, low unemployment, stable prices, sustainable balance of payments, and income redistribution.');
  M('5.1', 'Rapid economic growth may conflict with a current account objective because',
    ['rising incomes increase spending on imports', 'exports always fall', 'growth reduces imports', 'the exchange rate becomes fixed'], 0,
    'Higher incomes raise demand for imports, which can widen the current account deficit.');

  // 5.2 Fiscal policy
  M('5.2', 'Which is contractionary (deflationary) fiscal policy?',
    ['Raising income tax', 'Cutting interest rates', 'Increasing government spending', 'Selling foreign currency'], 0,
    'Higher taxes reduce disposable income and consumption, reducing AD.');
  M('5.2', 'The difference between a budget deficit and the national debt is that',
    ['the deficit is the shortfall in one year; the debt is the total accumulated borrowing', 'they are the same', 'the debt is annual, the deficit is total', 'the deficit only includes interest'], 0,
    'Deficits add to the national debt over time.');
  M('5.2', 'Which is a direct tax?',
    ['Corporation tax on company profits', 'Sales tax', 'Excise duty on alcohol', 'An import tariff'], 0,
    'Direct taxes are levied on income and wealth. Indirect taxes are on spending.');
  M('5.2', 'Which is a limitation of fiscal policy?',
    ['Time lags in planning and implementing spending changes', 'It cannot affect aggregate demand', 'It is controlled by the central bank', 'It only affects exports'], 0,
    'Recognition, decision and implementation lags mean fiscal policy may take effect too late.');

  // 5.3 Monetary policy
  M('5.3', 'A cut in interest rates is most likely to',
    ['increase borrowing and consumer spending', 'reduce investment', 'cause the currency to appreciate', 'increase saving'], 0,
    'Cheaper borrowing boosts C and I; the currency tends to depreciate as hot money flows out.');
  M('5.3', 'Quantitative easing is best described as',
    ['the central bank creating money to buy financial assets, increasing the money supply', 'raising interest rates', 'cutting government spending', 'fixing the exchange rate'], 0,
    'It aims to lower long-term interest rates and increase lending and spending.');
  M('5.3', 'Why might a rise in interest rates fail to reduce spending?',
    ['Consumer and business confidence is very high', 'Borrowing becomes more expensive', 'Saving becomes more attractive', 'Mortgage payments rise'], 0,
    'If people are very optimistic, they may continue to borrow and spend despite higher rates.');

  // 5.4 Supply-side policy
  M('5.4', 'Which is a market-based supply-side policy?',
    ['Reducing trade union power to make labour markets more flexible', 'Increasing government spending on welfare', 'Raising interest rates', 'Imposing price controls'], 0,
    'Market-based policies deregulate and increase incentives; interventionist ones include state-funded training and infrastructure.');
  M('5.4', 'Cutting income tax rates may be a supply-side policy because it',
    ['increases the incentive to work and take risks', 'raises aggregate demand only', 'always increases tax revenue', 'reduces the money supply'], 0,
    'Higher take-home pay can encourage labour supply and enterprise, although it also raises AD.');
  M('5.4', 'Privatisation may increase efficiency because',
    ['private owners have a profit incentive to cut costs', 'the state gains more control', 'prices are fixed by law', 'competition is eliminated'], 0,
    'The profit motive and competition can improve efficiency, though private monopolies may need regulation.');
  M('5.4', 'Which supply-side policy is interventionist rather than market-based?',
    ['Government spending on infrastructure', 'Deregulation', 'Privatisation', 'Lower corporation tax'], 0,
    'The state directly invests to raise productive capacity.');

  // 6.1 International trade
  M('6.1', `The table shows output per worker per day. ${tbl(['', 'Rice (tonnes)', 'Cloth (metres)'], [['Country X', '10', '20'], ['Country Y', '6', '6']])}Which statement is correct?`,
    ['Y has a comparative advantage in rice', 'Y has a comparative advantage in cloth', 'X has a comparative advantage in rice', 'Neither country gains from trade'], 0,
    'In X, 1 rice costs 2 cloth. In Y, 1 rice costs 1 cloth. Y has the lower opportunity cost of rice, so Y has the comparative advantage in rice and X in cloth. X has an absolute advantage in both.');
  M('6.1', 'Which is a benefit of free trade?',
    ['Consumers get lower prices and more choice', 'Domestic firms face less competition', 'All industries grow', 'It prevents structural unemployment'], 0,
    'Specialisation according to comparative advantage raises total output. Some domestic industries may lose out.');
  M('6.1', 'The terms of trade index rises from 100 to 110. What does this mean?',
    ['Each unit of exports buys more imports than before', 'The country exports more goods', 'The trade balance improves for certain', 'Import prices rose faster than export prices'], 0,
    'A favourable movement in the terms of trade: export prices have risen relative to import prices.');
  M('6.1', 'Which limits the benefits of specialisation and trade?',
    ['High transport costs', 'Differences in opportunity costs', 'Economies of scale', 'Larger markets'], 0,
    'Transport costs and trade barriers can outweigh the gains from comparative advantage.');

  // 6.2 Protectionism
  M('6.2', 'An import quota is',
    ['a physical limit on the quantity of a good that can be imported', 'a tax on imports', 'a subsidy to exporters', 'a ban on all trade'], 0,
    'Quotas restrict volume; tariffs raise price.');
  M('6.2', 'Dumping means',
    ['selling exports abroad below the cost of production or below the domestic price', 'imposing tariffs', 'importing goods illegally', 'removing trade barriers'], 0,
    'Anti-dumping measures are a common justification for protection.');
  M('6.2', 'Which is a likely consequence of a country imposing tariffs?',
    ['Trading partners retaliate with their own tariffs', 'Consumers pay lower prices', 'Imports rise', 'Domestic producers become more efficient'], 0,
    'Retaliation can reduce exports and lead to trade wars.');
  G('6.2', { type: 'tariff' }, 'Which area shows the gain in producer surplus to domestic firms from the tariff?',
    ['A', 'B', 'C', 'D'], 0,
    'Domestic producers sell more (Q1 to Q2) at a higher price. Area A is transferred from consumers to domestic producers.');

  // 6.3 Current account
  M('6.3', 'A country\'s residents receive dividends from shares they own in foreign companies. This is recorded as',
    ['a credit in primary income', 'a debit in primary income', 'a credit in secondary income', 'trade in services'], 0,
    'Investment income (interest, profits, dividends) is primary income. Money flowing in is a credit.');
  M('6.3', 'Tourists from abroad spend money in a country. In that country\'s current account this is',
    ['an export of services (a credit)', 'an import of services', 'a secondary income debit', 'a financial account inflow'], 0,
    'Foreign tourists buying services here earns foreign currency, just like an export.');
  M('6.3', 'Which is a likely cause of a current account deficit?',
    ['High domestic inflation making exports less competitive', 'A weak currency', 'Falling domestic incomes', 'High foreign demand for exports'], 0,
    'Uncompetitive prices reduce exports and encourage imports.');
  M('6.3', 'Why might a persistent current account deficit be a concern?',
    ['It must be financed by borrowing or selling assets to foreigners', 'It always causes inflation', 'It raises exports', 'It reduces imports'], 0,
    'A long-term deficit may lead to rising foreign debt and pressure on the exchange rate. A short-term deficit during investment may be less of a concern.');

  // 6.4 Exchange rates
  M('6.4', 'The exchange rate changes from $1 = €0.80 to $1 = €0.90. What has happened to the dollar?',
    ['It has appreciated against the euro', 'It has depreciated against the euro', 'It is unchanged', 'It has been devalued'], 0,
    'One dollar now buys more euros, so the dollar is worth more.');
  M('6.4', 'Which would cause a floating currency to depreciate?',
    ['Domestic residents buying more imports', 'Foreign tourists visiting more', 'Higher domestic interest rates', 'Foreign firms investing in the country'], 0,
    'Buying imports requires selling the domestic currency, increasing its supply.');
  M('6.4', 'A central bank wants to stop its fixed currency from falling. It could',
    ['buy its own currency using foreign currency reserves', 'sell its own currency', 'cut interest rates', 'print more money'], 0,
    'Buying the currency increases demand for it; raising interest rates also helps.');
  M('6.4', 'A managed float is an exchange rate system in which',
    ['market forces set the rate but the central bank intervenes at times', 'the rate never changes', 'there is no central bank', 'the rate is set by other countries'], 0,
    'It combines features of floating and fixed systems.');
  G('6.4', { type: 'fx', shift: 'S', dir: 'right' }, 'What could cause the supply of the currency to shift to S1?',
    ['Residents investing more abroad', 'Foreigners buying more of the country\'s exports', 'A rise in domestic interest rates', 'Speculators expecting the currency to rise'], 0,
    'To invest abroad, residents sell their own currency, increasing its supply and causing depreciation.');

  // 6.5 Policies for current account imbalances
  M('6.5', 'Which is an expenditure-reducing policy?',
    ['Raising income tax', 'Devaluing the currency', 'Imposing an import quota', 'Subsidising exporters'], 0,
    'Expenditure-reducing policies cut total spending (including on imports). The others switch spending towards domestic goods.');
  M('6.5', 'Which supply-side policy could improve the current account in the long run?',
    ['Investment in training to raise productivity and export competitiveness', 'Higher interest rates', 'A rise in income tax', 'A budget deficit'], 0,
    'Lower costs and better quality raise the competitiveness of exports without reducing growth.');
  M('6.5', 'A problem with using contractionary fiscal policy to reduce a current account deficit is that it',
    ['also reduces economic growth and may raise unemployment', 'always increases imports', 'raises inflation', 'causes appreciation'], 0,
    'Lower AD cuts spending on imports but also on domestic output.');

  // Paper 2 style
  P2('3.3', `<b>Essay.</b> (a) Explain the difference between a progressive and a regressive tax. [8]<br>(b) Discuss whether raising the top rate of income tax is the best way to reduce inequality. [12]`,
    ['(a) Progressive: proportion of income taken rises as income rises; example', '(a) Regressive: proportion falls as income rises; e.g. indirect taxes', '(a) Effect of each on the distribution of income', '(b) For: redistributes income, funds benefits and services', '(b) Against: disincentive to work, tax avoidance, emigration of high earners, may raise little revenue', '(b) Alternatives: means-tested benefits, minimum wage, education and training, wealth taxes', '(b) Supported conclusion'],
    null);
  P2('4.5', `<b>Data response (style).</b> Unemployment in a country rose from 5% to 8% during a recession, while manufacturing jobs continued a long decline.<br><br>(a) Identify two types of unemployment suggested by the data. [2]<br>(b) Explain two costs of unemployment to the economy. [4]<br>(c) Discuss whether expansionary fiscal policy will reduce this unemployment. [6]`,
    ['(a) Cyclical (recession) and structural (manufacturing decline)', '(b) Lost output: economy inside its PPC', '(b) Fiscal cost: benefits paid and tax revenue lost; social costs', '(c) Fiscal stimulus raises AD, reducing cyclical unemployment', '(c) It does not fix structural mismatch: needs retraining / supply-side policy', '(c) Considers time lags, deficit, inflation risk; conclusion'],
    null);
  P2('6.4', `<b>Essay.</b> (a) Explain how a floating exchange rate is determined. [8]<br>(b) Discuss whether a fixed exchange rate is better than a floating exchange rate for a developing economy. [12]`,
    ['(a) Demand for currency: exports, inward investment, hot money', '(a) Supply of currency: imports, investment abroad', '(a) Diagram with equilibrium and a shift causing appreciation/depreciation', '(b) Fixed: certainty for traders and investors, discipline on inflation', '(b) Fixed: needs large reserves, loss of monetary policy independence, risk of speculative attack', '(b) Floating: automatic adjustment of current account, independent interest rates', '(b) Floating: volatility and uncertainty, imported inflation', '(b) Supported conclusion'],
    null);
})();
