// Cambridge International AS Level Economics 9708 (AS topics 1.1–6.5 only).
(function () {
  const S = 'econ';
  const T = (id, name, group) => Bank.topic(S, id, name, group);
  const M = (topic, q, options, answer, explain) => Bank.add(S, { type: 'mcq', topic, q, options, answer, explain, papers: [1] });
  const G = (topic, graph, q, options, answer, explain) => Bank.add(S, { type: 'mcq', topic, graph, q, options, answer, explain, papers: [1, 2] });
  const GEN = (topic, make) => Bank.add(S, { gen: true, topic, make, papers: [1, 2] });
  const P2 = (topic, prompt, points, model) => Bank.add(S, { type: 'self', topic, prompt, points, model, papers: [2] });
  const { rnd, pick, r2 } = Bank;

  const g1 = '1 Basic economic ideas and resource allocation';
  T('1.1', 'Scarcity, choice and opportunity cost', g1);
  T('1.2', 'Economic methodology', g1);
  T('1.3', 'Factors of production', g1);
  T('1.4', 'Resource allocation in different economic systems', g1);
  T('1.5', 'Production possibility curves', g1);
  T('1.6', 'Classification of goods and services', g1);
  const g2 = '2 The price system and the microeconomy';
  T('2.1', 'Demand and supply curves', g2);
  T('2.2', 'Price, income and cross elasticity of demand', g2);
  T('2.3', 'Price elasticity of supply', g2);
  T('2.4', 'The interaction of demand and supply', g2);
  T('2.5', 'Consumer and producer surplus', g2);
  const g3 = '3 Government microeconomic intervention';
  T('3.1', 'Reasons for government intervention in markets', g3);
  T('3.2', 'Methods and effects of government intervention', g3);
  T('3.3', 'Addressing income and wealth inequality', g3);
  const g4 = '4 The macroeconomy';
  T('4.1', 'National income statistics', g4);
  T('4.2', 'Introduction to the circular flow of income', g4);
  T('4.3', 'Aggregate demand and aggregate supply analysis', g4);
  T('4.4', 'Economic growth', g4);
  T('4.5', 'Unemployment', g4);
  T('4.6', 'Price stability', g4);
  const g5 = '5 Government macroeconomic intervention';
  T('5.1', 'Government macroeconomic policy objectives', g5);
  T('5.2', 'Fiscal policy', g5);
  T('5.3', 'Monetary policy', g5);
  T('5.4', 'Supply-side policy', g5);
  const g6 = '6 International economic issues';
  T('6.1', 'The reasons for international trade', g6);
  T('6.2', 'Protectionism', g6);
  T('6.3', 'Current account of the balance of payments', g6);
  T('6.4', 'Exchange rates', g6);
  T('6.5', 'Policies to correct imbalances in the current account', g6);

  // ---------- Paper 1 style multiple choice ----------
  M('1.1', 'What is the basic economic problem?',
    ['Unlimited wants but finite resources', 'Prices are too high for low-income households', 'Governments spend more than they receive in tax', 'Firms do not always maximise profit'], 0,
    'Scarcity: wants are unlimited but the resources to satisfy them are finite, so choices must be made.');
  M('1.1', 'A student chooses to work a paid shift instead of attending a free revision class. What is the opportunity cost of working?',
    ['The wage earned', 'The revision class given up', 'The travel cost to work', 'Nothing, because the class was free'], 1,
    'Opportunity cost is the next best alternative foregone, here the revision class. A zero price does not mean zero opportunity cost.');
  M('1.1', 'Which is an example of thinking at the margin?',
    ['A firm compares the extra revenue and extra cost of producing one more unit', 'A government sets a target for the total budget', 'A household records all spending last year', 'A country measures total GDP'], 0,
    'Marginal decisions compare the additional benefit and additional cost of a small change.');
  M('1.2', 'Which statement is normative?',
    ['A rise in the minimum wage will reduce employment by 2%', 'Inflation was 4% last year', 'The government ought to reduce income inequality', 'Higher interest rates reduce borrowing'], 2,
    'Normative statements contain value judgements (ought, should, fair). The others can be tested against evidence, so they are positive.');
  M('1.2', 'What does the term ceteris paribus mean in economic analysis?',
    ['All other things being equal', 'In the long run', 'At the margin', 'Holding prices fixed only'], 0,
    'Ceteris paribus isolates the effect of one variable by assuming all other influences stay unchanged.');
  M('1.2', 'In economics, the long run is best defined as the period in which',
    ['all factors of production are variable', 'at least one factor of production is fixed', 'technology can change', 'more than one year has passed'], 0,
    'Short run: at least one factor fixed. Long run: all factors variable. Very long run: technology and other conditions can change too. It is not a fixed number of years.');
  M('1.3', 'What is the reward to the factor of production enterprise?',
    ['Wages', 'Rent', 'Interest', 'Profit'], 3,
    'Land earns rent, labour earns wages, capital earns interest and enterprise earns profit.');
  M('1.3', 'Which is an example of capital as a factor of production?',
    ['Money saved in a bank', 'A delivery van used by a firm', 'Shares in a company', 'Oil under the sea bed'], 1,
    'Capital is a man-made aid to production. Money and shares are financial assets, and oil is land (natural resources).');
  M('1.3', 'Which is a likely disadvantage of the division of labour?',
    ['Higher output per worker', 'Workers become bored by repetitive tasks', 'Less time wasted switching tasks', 'Workers develop specialist skills'], 1,
    'Specialisation can cause boredom and low motivation. The other options are advantages.');
  M('1.4', 'In a planned economy, resources are mainly allocated by',
    ['the price mechanism', 'the state', 'consumers voting with their money', 'private firms seeking profit'], 1,
    'In a planned economy the government decides what, how and for whom to produce.');
  M('1.4', 'Which is a feature of a mixed economy?',
    ['There is no private property', 'All goods are provided by the state', 'Both the private and public sectors allocate resources', 'There are no taxes'], 2,
    'A mixed economy combines market allocation with government intervention and a public sector.');
  M('1.4', 'Which of the following is NOT a function of the price mechanism?',
    ['Signalling', 'Rationing', 'Providing incentives', 'Guaranteeing equal incomes'], 3,
    'Prices signal, ration and provide incentives. The market does not guarantee equality, which is one reason governments intervene.');
  M('1.5', 'A movement from a point on a PPC to a point inside it most likely shows',
    ['an increase in unemployment', 'economic growth', 'an improvement in technology', 'more capital goods being produced'], 0,
    'Points inside the curve mean resources are unemployed or used inefficiently.');
  M('1.5', 'Why is a PPC usually drawn concave (bowed outwards) to the origin?',
    ['Resources are not equally suited to producing both goods', 'Opportunity cost is zero', 'Resources are unlimited', 'Both goods have the same price'], 0,
    'As more of one good is made, less suitable resources are moved across, so the opportunity cost rises.');
  M('1.6', 'Which characteristics make a good a pure public good?',
    ['Rival and excludable', 'Non-rival and non-excludable', 'Rival and non-excludable', 'Non-rival and excludable'], 1,
    'Public goods are non-rival (one person\'s use does not reduce availability) and non-excludable, which leads to the free-rider problem.');
  M('1.6', 'A merit good is best described as a good that',
    ['is always provided free by the government', 'would be under-consumed if left to the market, partly due to information failure', 'is non-excludable', 'causes harm to the consumer'], 1,
    'Merit goods (e.g. education, vaccinations) are under-consumed in a free market, often because people underestimate their benefits.');
  M('1.6', 'What is a free good?',
    ['A good provided by the government at zero price', 'A good with zero opportunity cost to produce', 'A good paid for through taxation', 'A public good'], 1,
    'A free good (e.g. air, sea water) is not scarce and has zero opportunity cost. A good provided free by the state still uses scarce resources.');
  M('1.6', 'Which is the best example of a demerit good?',
    ['Cigarettes', 'Street lighting', 'Health care', 'Bread'], 0,
    'Demerit goods are over-consumed in a free market; consumers underestimate their harm.');

  M('2.1', 'Which would cause a movement along the demand curve for coffee, rather than a shift?',
    ['A rise in the price of tea', 'A fall in the price of coffee', 'An increase in consumer income', 'An advertising campaign for coffee'], 1,
    'Only a change in the good\'s own price causes a movement along its demand curve. Other factors shift the curve.');
  M('2.1', 'The price of a normal good\'s substitute falls. What happens to demand for the normal good?',
    ['It increases', 'It decreases', 'Quantity demanded rises along the curve', 'No change'], 1,
    'Consumers switch to the cheaper substitute, so demand for the original good falls (shifts left).');
  M('2.1', 'Which would shift the supply curve for wheat to the right?',
    ['A rise in the price of wheat', 'A rise in the wage rate of farm workers', 'Improved fertiliser technology', 'A tax on wheat producers'], 2,
    'Better technology lowers costs of production, increasing supply. A tax or higher wages reduce supply.');
  M('2.2', 'Price elasticity of demand for a good is -0.4. The price rises by 10%. What happens?',
    ['Quantity demanded falls by 4% and revenue rises', 'Quantity demanded falls by 25% and revenue falls', 'Quantity demanded falls by 4% and revenue falls', 'Quantity demanded rises by 4%'], 0,
    'PED = %ΔQd ÷ %ΔP, so %ΔQd = -0.4 × 10 = -4%. Demand is inelastic, so a price rise increases total revenue.');
  M('2.2', 'Income elasticity of demand for a good is -0.6. The good is',
    ['a luxury', 'a normal necessity', 'an inferior good', 'a complement'], 2,
    'Negative YED means demand falls as income rises: an inferior good.');
  M('2.2', 'The cross elasticity of demand between two goods is +1.5. The goods are',
    ['complements', 'substitutes', 'unrelated', 'inferior'], 1,
    'Positive XED: a rise in the price of one raises demand for the other, so they are substitutes.');
  M('2.2', 'Which factor would make demand for a product more price elastic?',
    ['It is habit-forming', 'It has many close substitutes', 'It takes a small share of income', 'It is a necessity'], 1,
    'More close substitutes mean consumers can switch easily when price rises.');
  M('2.2', 'Along a straight-line downward-sloping demand curve, PED',
    ['is constant', 'is unitary everywhere', 'falls (in absolute value) as price falls', 'rises as price falls'], 2,
    'The slope is constant but the ratio P/Q changes. At high prices demand is elastic; at low prices it is inelastic; it is unitary at the midpoint.');
  M('2.3', 'Which would make supply of a good more price elastic?',
    ['The good is perishable and cannot be stored', 'Firms have large spare capacity', 'Production takes a long time', 'Factors of production are immobile'], 1,
    'Spare capacity (and stocks, mobile factors, a longer time period) lets firms raise output quickly when price rises.');
  M('2.3', 'A supply curve that is a straight line through the origin has PES equal to',
    ['0', '1', 'infinity', 'it depends on the slope'], 1,
    'Any straight-line supply curve through the origin has unitary elasticity, whatever its slope.');
  M('2.4', 'Cars and petrol are in joint demand. A large rise in the price of petrol is most likely to',
    ['increase demand for cars', 'reduce demand for cars', 'increase supply of cars', 'have no effect on cars'], 1,
    'Complements (joint demand): a higher petrol price makes running a car dearer, so demand for cars falls.');
  M('2.4', 'Beef and leather are in joint supply. Demand for beef increases. What happens in the leather market?',
    ['Supply of leather increases and its price falls', 'Supply of leather falls and its price rises', 'Demand for leather rises', 'No change'], 0,
    'More cattle are slaughtered for beef, so the by-product leather has a larger supply and its price falls.');
  M('2.4', 'Demand for labour is described as derived demand because',
    ['it depends on demand for the goods that labour produces', 'wages are set by government', 'labour is a fixed factor', 'workers supply more labour at higher wages'], 0,
    'Firms want labour for what it produces. If demand for the product rises, demand for labour rises.');
  M('2.4', 'At a price above equilibrium, the market will have',
    ['excess demand, so price rises', 'excess supply, so price falls', 'excess supply, so price rises', 'equilibrium'], 1,
    'Above equilibrium, quantity supplied exceeds quantity demanded. The surplus pushes price down.');
  M('2.5', 'Consumer surplus is the difference between',
    ['what consumers are willing to pay and what they actually pay', 'the price and the cost of production', 'total revenue and total cost', 'demand and supply'], 0,
    'Consumer surplus is the area below the demand curve and above the price.');
  M('2.5', 'An increase in supply of a good, with demand unchanged, will usually',
    ['reduce consumer surplus', 'increase consumer surplus', 'leave consumer surplus unchanged', 'eliminate producer surplus'], 1,
    'Price falls and quantity rises, so the area under demand and above price gets larger.');

  M('3.1', 'Which is a reason for government intervention in markets?',
    ['Markets produce too many public goods', 'Merit goods are under-consumed in a free market', 'Prices always rise too slowly', 'Firms always produce at the lowest cost'], 1,
    'Market failure, e.g. under-consumption of merit goods, over-consumption of demerit goods and non-provision of public goods, justifies intervention.');
  M('3.1', 'The free-rider problem means that',
    ['people can benefit from a good without paying, so the market may not provide it', 'people consume too many demerit goods', 'firms receive subsidies', 'goods are rationed by queues'], 0,
    'If people cannot be excluded, they have no incentive to pay, so private firms cannot make a profit supplying the good.');
  M('3.2', 'A specific tax is imposed on a good with perfectly inelastic demand. Who pays the tax?',
    ['Consumers pay all of it', 'Producers pay all of it', 'It is shared equally', 'Nobody, because quantity does not change'], 0,
    'With perfectly inelastic demand, price rises by the full amount of the tax, so the whole burden falls on consumers.');
  M('3.2', 'A maximum price set below the equilibrium price will cause',
    ['a surplus', 'a shortage', 'no effect', 'a higher market price'], 1,
    'At the lower price, quantity demanded exceeds quantity supplied. Queues, rationing or a black market may result.');
  M('3.2', 'A minimum price set above equilibrium in an agricultural market will most likely',
    ['create a surplus that the government may have to buy', 'create a shortage', 'reduce farmers\' incomes', 'lower the market price'], 0,
    'Quantity supplied exceeds quantity demanded at the higher price, so there is a surplus.');
  M('3.2', 'Which is a disadvantage of a government subsidy to producers?',
    ['It lowers price for consumers', 'It has an opportunity cost for government spending', 'It increases output', 'It can encourage consumption of merit goods'], 1,
    'Subsidies must be funded, so money cannot be spent elsewhere, and they may make firms inefficient.');
  M('3.2', 'Which method of intervention is used to reduce consumption of a demerit good?',
    ['A subsidy', 'A maximum price', 'An indirect tax', 'Direct provision'], 2,
    'An indirect tax raises price and reduces quantity. Regulation, bans and information campaigns are other options.');
  M('3.3', 'Which is a progressive tax?',
    ['A tax that takes a higher proportion of income as income rises', 'A tax of the same amount from everyone', 'A tax that takes a lower proportion of income as income rises', 'A sales tax on food'], 0,
    'Progressive taxes reduce inequality. Taxes on spending (like sales tax) are often regressive.');
  M('3.3', 'Which distinguishes wealth from income?',
    ['Wealth is a stock of assets; income is a flow over time', 'Wealth is a flow; income is a stock', 'They mean the same thing', 'Income is only from wages'], 0,
    'Income is received over a period of time; wealth is the value of assets owned at a point in time.');
  M('3.3', 'A rise in the Gini coefficient from 0.32 to 0.41 means',
    ['income is more equally distributed', 'income is less equally distributed', 'average income has risen', 'poverty has been eliminated'], 1,
    'The Gini coefficient runs from 0 (perfect equality) to 1 (perfect inequality).');

  M('4.1', 'GDP at market prices minus indirect taxes plus subsidies gives',
    ['GDP at basic prices', 'GNI', 'NNI', 'real GDP'], 0,
    'Market prices include indirect taxes and exclude subsidies. Removing taxes and adding subsidies gives GDP at basic prices.');
  M('4.1', 'GNI is equal to GDP plus',
    ['net income from abroad', 'depreciation', 'indirect taxes', 'exports minus imports'], 0,
    'GNI = GDP + net primary income from abroad. NNI = GNI - depreciation (capital consumption).');
  M('4.1', 'Nominal GDP rose by 8% and prices rose by 5%. Real GDP rose by approximately',
    ['13%', '8%', '3%', '1.6%'], 2,
    'Real growth ≈ nominal growth - inflation = 8% - 5% = 3%.');
  M('4.2', 'In the circular flow of income, which is an injection?',
    ['Savings', 'Taxation', 'Imports', 'Investment'], 3,
    'Injections: investment, government spending, exports. Withdrawals (leakages): savings, taxation, imports.');
  M('4.2', 'National income will rise when',
    ['injections are greater than withdrawals', 'withdrawals are greater than injections', 'savings increase', 'imports increase'], 0,
    'If injections exceed withdrawals, spending in the flow rises and national income increases until equilibrium is restored.');
  M('4.3', 'Which is a component of aggregate demand?',
    ['Savings', 'Net exports', 'Taxation', 'Productivity'], 1,
    'AD = C + I + G + (X - M).');
  M('4.3', 'Why does the AD curve slope downwards?',
    ['A lower price level raises real wealth and makes exports more competitive', 'Firms produce more at higher prices', 'Wages are fixed', 'Governments cut taxes'], 0,
    'Real balance (wealth) effect, interest rate effect and international trade effect make real output demanded rise as the price level falls.');
  M('4.3', 'A large rise in world oil prices is most likely to',
    ['shift AS to the left, raising the price level and reducing real output', 'shift AD to the right', 'shift AS to the right', 'reduce the price level'], 0,
    'Higher costs of production reduce aggregate supply: cost-push inflation plus lower real output.');
  M('4.4', 'Economic growth is best defined as',
    ['an increase in real GDP', 'an increase in nominal GDP', 'an increase in the price level', 'an increase in population'], 0,
    'Actual growth is a rise in real output (real GDP). Potential growth is an increase in productive capacity.');
  M('4.4', 'Which would increase an economy\'s potential output?',
    ['A fall in unemployment', 'Investment in education and training', 'A rise in consumer spending', 'A fall in interest rates with no change in capacity'], 1,
    'Better quality labour raises productive capacity (shifts the PPC / LRAS outwards).');
  M('4.5', 'Workers who lose their jobs because their skills are no longer needed after an industry declines are',
    ['frictionally unemployed', 'structurally unemployed', 'seasonally unemployed', 'cyclically unemployed'], 1,
    'Structural unemployment results from long-term changes in the structure of the economy.');
  M('4.5', 'The unemployment rate is calculated as',
    ['unemployed ÷ labour force × 100', 'unemployed ÷ population × 100', 'employed ÷ labour force × 100', 'unemployed ÷ employed × 100'], 0,
    'The labour force is the employed plus the unemployed.');
  M('4.5', 'People between jobs who are searching for new work are',
    ['frictionally unemployed', 'structurally unemployed', 'cyclically unemployed', 'not in the labour force'], 0,
    'Frictional (search) unemployment is short term, as people move between jobs.');
  M('4.6', 'Demand-pull inflation is caused by',
    ['aggregate demand growing faster than aggregate supply', 'rising costs of production', 'a fall in money supply', 'lower import prices'], 0,
    'Excess demand pulls up the general price level.');
  M('4.6', 'Deflation means',
    ['a fall in the general price level', 'a fall in the rate of inflation', 'a fall in real GDP', 'a fall in the exchange rate'], 0,
    'Deflation is a sustained fall in the price level. A fall in the rate of inflation (prices still rising) is disinflation.');
  M('4.6', 'Who is most likely to lose from unexpected inflation?',
    ['Borrowers with fixed-interest loans', 'People on fixed incomes', 'Firms with rising prices', 'The government as a borrower'], 1,
    'Fixed incomes buy less as prices rise. Borrowers tend to gain as the real value of debt falls.');
  M('4.6', 'A consumer price index is built by',
    ['weighting price changes by the share of household spending on each item', 'averaging the prices of all goods equally', 'measuring changes in wages', 'measuring changes in GDP'], 0,
    'A weighted price index uses expenditure weights so that items people spend more on count for more.');

  M('5.1', 'Which is a usual macroeconomic policy objective?',
    ['A high and rising inflation rate', 'Low and stable inflation', 'A large current account deficit', 'Rising unemployment'], 1,
    'Main objectives: low stable inflation, low unemployment, economic growth and a sustainable balance of payments (plus redistribution).');
  M('5.1', 'Which pair of objectives is most likely to conflict in the short run?',
    ['Low unemployment and low inflation', 'Economic growth and low unemployment', 'Low inflation and a stable exchange rate', 'Growth and higher living standards'], 0,
    'Boosting AD to cut unemployment can raise inflation.');
  M('5.2', 'Which is an example of expansionary fiscal policy?',
    ['Raising interest rates', 'Cutting income tax', 'Selling government bonds', 'Reducing government spending'], 1,
    'Fiscal policy uses government spending and taxation. Lower taxes raise disposable income and AD.');
  M('5.2', 'A budget deficit occurs when',
    ['government spending exceeds tax revenue', 'imports exceed exports', 'tax revenue exceeds government spending', 'national debt falls'], 0,
    'Budget deficit: G > T. It adds to the national debt.');
  M('5.2', 'An automatic stabiliser is',
    ['a change in spending or tax revenue that happens without a policy decision as the economy changes', 'a rise in interest rates', 'a fixed exchange rate', 'a law limiting government debt'], 0,
    'In a recession, benefit payments rise and tax receipts fall automatically, supporting AD.');
  M('5.3', 'A central bank wants to reduce inflation. The most likely monetary policy is to',
    ['cut interest rates', 'raise interest rates', 'raise government spending', 'cut income tax'], 1,
    'Higher interest rates raise the cost of borrowing and reward saving, reducing C and I and so AD.');
  M('5.3', 'Which is a monetary policy tool?',
    ['Changing the money supply', 'Changing income tax', 'Privatisation', 'Changing tariffs'], 0,
    'Monetary policy tools: interest rates, money supply, and the exchange rate.');
  M('5.4', 'Which is a supply-side policy?',
    ['Increasing spending on training', 'Cutting interest rates', 'Increasing unemployment benefit', 'Raising import tariffs'], 0,
    'Supply-side policies aim to raise productive capacity and efficiency (training, deregulation, privatisation, lower direct taxes).');
  M('5.4', 'Which is a limitation of supply-side policies?',
    ['They often take a long time to have an effect', 'They always cause inflation', 'They reduce productive capacity', 'They only affect aggregate demand'], 0,
    'Education and infrastructure take years to raise capacity, and costs are paid up front.');

  M('6.1', 'Country X can produce both cloth and wheat with fewer resources than Country Y. Trade can still benefit both if',
    ['their opportunity cost ratios differ', 'X has an absolute advantage in both', 'Y has no resources', 'both have identical costs'], 0,
    'Gains from trade come from comparative advantage, i.e. different opportunity costs.');
  M('6.1', 'The terms of trade are calculated as',
    ['index of export prices ÷ index of import prices × 100', 'value of exports - value of imports', 'import prices ÷ export prices × 100', 'exports ÷ GDP'], 0,
    'A rise in the index is a favourable (improving) movement: each unit of exports buys more imports.');
  M('6.2', 'Which is a protectionist measure?',
    ['A quota on imported steel', 'A free-trade agreement', 'Removing export taxes', 'A floating exchange rate'], 0,
    'Tariffs, quotas, embargoes, subsidies to domestic producers and excessive administrative burdens are forms of protectionism.');
  M('6.2', 'Which argument for protection is most closely linked to new industries?',
    ['The infant industry argument', 'The anti-dumping argument', 'Comparative advantage', 'The terms of trade effect'], 0,
    'New industries may need temporary protection until they grow large enough to benefit from economies of scale.');
  M('6.3', 'Which item is recorded in the current account of the balance of payments?',
    ['Foreign direct investment', 'Exports of services', 'Purchase of foreign shares', 'Loans from abroad'], 1,
    'The current account includes trade in goods, trade in services, primary income and secondary income. FDI and portfolio flows are in the financial account.');
  M('6.3', 'Money sent home by migrant workers is recorded under',
    ['secondary income', 'primary income', 'trade in services', 'the financial account'], 0,
    'Current transfers such as remittances and foreign aid are secondary income. Wages, interest, profits and dividends are primary income.');
  M('6.4', 'A country\'s currency depreciates. What is the likely effect?',
    ['Exports become cheaper abroad and imports more expensive', 'Exports become more expensive abroad', 'Imports become cheaper', 'Inflation falls'], 0,
    'A weaker currency makes exports more competitive and imports dearer, which can add to inflation.');
  M('6.4', 'Which would cause a country\'s floating exchange rate to appreciate?',
    ['A rise in domestic interest rates relative to other countries', 'A rise in imports', 'Higher inflation than trading partners', 'Speculators expecting the currency to fall'], 0,
    'Higher interest rates attract hot money inflows, raising demand for the currency.');
  M('6.4', 'Under a fixed exchange rate system, the exchange rate is',
    ['set by market forces alone', 'kept at a set value by the central bank buying and selling currency', 'changed daily by government', 'unrelated to reserves'], 1,
    'The central bank intervenes using foreign currency reserves (and interest rates) to keep the rate at its target.');
  M('6.4', 'Devaluation refers to',
    ['a fall in a fixed exchange rate by the government', 'a fall in a floating exchange rate', 'a rise in a fixed rate', 'a fall in the price level'], 0,
    'Devaluation / revaluation apply to fixed rates. Depreciation / appreciation apply to floating rates.');
  M('6.5', 'Which policy would be expenditure-switching to reduce a current account deficit?',
    ['Imposing tariffs on imports', 'Raising income tax', 'Cutting government spending', 'Raising interest rates to reduce consumption'], 0,
    'Expenditure-switching moves spending from imports to domestic goods (tariffs, devaluation). Expenditure-reducing cuts total spending (contractionary fiscal and monetary policy).');
  M('6.5', 'Why might a depreciation fail to improve the current account?',
    ['Demand for exports and imports is price inelastic', 'Demand for exports is highly elastic', 'Imports become more expensive', 'Exports become cheaper'], 0,
    'If PED for exports and imports is low, quantities change little, so export revenue may not rise enough and spending on imports may even increase.');

  // ---------- Diagram questions (both papers) ----------
  G('2.4', { type: 'shift', shift: 'D', dir: 'right' }, 'The diagram shows a shift from E0 to E1. What could have caused it?',
    ['A rise in incomes, if the good is normal', 'A fall in the cost of raw materials', 'A rise in the price of a complement', 'An indirect tax on the good'], 0,
    'Demand shifts right (D to D1), raising both price and quantity. Higher income increases demand for a normal good.');
  G('2.4', { type: 'shift', shift: 'S', dir: 'right' }, 'Supply shifts from S to S1. Which describes the new equilibrium E1?',
    ['Lower price, higher quantity', 'Higher price, lower quantity', 'Higher price, higher quantity', 'Lower price, lower quantity'], 0,
    'An increase in supply creates excess supply at P0, so price falls to P1 and quantity rises to Q1.');
  G('2.1', { type: 'shift', shift: 'S', dir: 'left' }, 'Which event could explain the shift from S to S1 shown?',
    ['A rise in wages in the industry', 'A new, more efficient technology', 'A subsidy to producers', 'A fall in the price of the good'], 0,
    'S1 is to the left of S: supply has decreased, e.g. because costs of production have risen.');
  G('3.2', { type: 'tax' }, 'A specific tax shifts supply to S+tax. Which area shows the tax paid by consumers?',
    ['A', 'B', 'A + B', 'C + D'], 0,
    'Consumers now pay P1 instead of P0, on Q1 units: area A. B is paid by producers; A + B is total tax revenue; C + D is the deadweight welfare loss.');
  G('3.2', { type: 'tax' }, 'Which area shows total government tax revenue?',
    ['A + B', 'A + B + C + D', 'C + D', 'B'], 0,
    'Tax per unit (P1 - P2) × quantity sold (Q1) = A + B.');
  G('3.2', { type: 'tax' }, 'Which area represents the deadweight (welfare) loss caused by the tax?',
    ['C + D', 'A + B', 'A', 'D only'], 0,
    'Output falls from Q0 to Q1. The lost consumer and producer surplus on those units, C + D, is not collected as tax.');
  G('3.2', { type: 'tax' }, 'In the diagram, consumers pay a larger share of the tax than producers. Why?',
    ['Demand is less price elastic than supply', 'Supply is perfectly inelastic', 'Demand is more price elastic than supply', 'The tax is ad valorem'], 0,
    'The burden falls more heavily on the side of the market that is less elastic, here demand (the steeper curve).');
  G('3.2', { type: 'subsidy' }, 'A per-unit subsidy shifts supply from S to S1. Which area shows the gain to consumers from the lower price?',
    ['X', 'Y', 'X + Y', 'None'], 0,
    'Consumers pay P1 instead of P0 on Q1 units: area X. Producers receive P2, gaining Y. Total subsidy cost = (P2 - P1) × Q1 = X + Y.');
  G('3.2', { type: 'priceControl', kind: 'max' }, 'The government sets the maximum price shown. What is the result?',
    ['Excess demand of Qd - Qs', 'Excess supply of Qs - Qd', 'Price rises to Pe', 'No effect because it is below equilibrium'], 0,
    'A maximum price below equilibrium is binding. Quantity demanded (Qd) exceeds quantity supplied (Qs).');
  G('3.2', { type: 'priceControl', kind: 'min' }, 'A minimum price is set at Pmin. What is the result?',
    ['Excess supply of Qs - Qd', 'Excess demand', 'Quantity traded rises to Qs', 'The market clears at Pmin'], 0,
    'Above equilibrium, suppliers want to sell Qs but consumers only buy Qd, leaving a surplus.');
  G('2.5', { type: 'surplus' }, 'Which area represents consumer surplus?',
    ['X', 'Y', 'Z', 'X + Y'], 0,
    'Consumer surplus is below the demand curve and above the price paid (Pe): area X. Y is producer surplus.');
  G('2.5', { type: 'surplus' }, 'Which area represents producer surplus?',
    ['Y', 'X', 'Z', 'Y + Z'], 0,
    'Producer surplus is above the supply curve and below the price received: area Y.');
  G('2.2', { type: 'revenue' }, 'Price falls from $8 to $6. What happens to total revenue?',
    ['It rises by $8, so demand is price elastic over this range', 'It falls by $4, so demand is inelastic', 'It rises by $12', 'It does not change'], 0,
    'Old TR = 8 × 2 = $16. New TR = 6 × 4 = $24. Lost area A = $4, gained area B = $12, net +$8. TR rises when price falls, so demand is price elastic here.');
  G('2.2', { type: 'twoDemand' }, 'At point P, which demand curve is more price elastic?',
    ['Db', 'Da', 'They are equally elastic', 'It cannot be known'], 0,
    'At the same price and quantity, the flatter curve (Db) shows a larger change in quantity for a given price change.');
  G('1.5', { type: 'ppc' }, 'Which point shows unemployed or inefficiently used resources?',
    ['B', 'A', 'C', 'D'], 0,
    'B is inside the PPC. A and D are on the curve (productively efficient); C lies outside and is unattainable with current resources.');
  G('1.5', { type: 'ppc', shift: true }, 'What could cause the shift from PPC to PPC1?',
    ['An improvement in technology in both industries', 'A fall in unemployment', 'A move from point B to point A', 'A rise in prices'], 0,
    'An outward shift is an increase in productive capacity: more or better resources, or better technology. A fall in unemployment moves the economy towards the curve.');
  G('1.5', { type: 'ppc' }, 'Moving from point D to point A involves',
    ['producing more capital goods with an opportunity cost of consumer goods', 'economic growth', 'using unemployed resources', 'no opportunity cost'], 0,
    'Both points are on the curve, so extra capital goods can only be made by giving up consumer goods.');
  G('4.3', { type: 'adas', shift: 'AD', dir: 'right' }, 'The shift from AD to AD1 is most likely caused by',
    ['a cut in income tax', 'a rise in interest rates', 'higher oil prices', 'a fall in exports'], 0,
    'Lower income tax raises disposable income and consumption, so AD increases. Real output rises (Y0→Y1) and the price level rises (P0→P1).');
  G('4.3', { type: 'adas', shift: 'AS', dir: 'left' }, 'The diagram shows AS shifting to AS1. Which describes the outcome?',
    ['Cost-push inflation with lower real output', 'Demand-pull inflation with higher output', 'Deflation with higher output', 'Economic growth'], 0,
    'A fall in AS raises the price level and reduces real output.');
  G('6.4', { type: 'fx', shift: 'D', dir: 'right' }, 'Demand for the currency shifts from D to D1. What could explain this?',
    ['Foreigners buy more of the country\'s exports', 'The country imports more', 'Domestic interest rates fall', 'Domestic inflation rises faster than abroad'], 0,
    'To pay for exports, foreigners must buy the currency, so demand for it rises and it appreciates (ER0→ER1).');
  G('6.4', { type: 'fx', shift: 'S', dir: 'right' }, 'Supply of the currency shifts to S1. What happens to the exchange rate?',
    ['It depreciates', 'It appreciates', 'It is unchanged', 'It becomes fixed'], 0,
    'More currency is supplied (e.g. residents buying more imports), so the price of the currency falls.');
  G('6.2', { type: 'tariff' }, 'A tariff raises the domestic price from Pw to Pw+t. Which area is the government\'s tariff revenue?',
    ['C', 'A', 'B + D', 'A + B + C + D'], 0,
    'Tariff revenue = tariff per unit × imports after the tariff (Q3 - Q2) = C. A is a transfer to domestic producers; B + D is the net welfare loss.');
  G('6.2', { type: 'tariff' }, 'What happens to the volume of imports after the tariff?',
    ['Falls from Q4-Q1 to Q3-Q2', 'Rises from Q3-Q2 to Q4-Q1', 'Unchanged', 'Falls to zero'], 0,
    'Domestic producers supply more (Q1→Q2) and consumers buy less (Q4→Q3), so imports shrink.');
  G('3.3', { type: 'lorenz' }, 'How is the Gini coefficient calculated from the diagram?',
    ['A ÷ (A + B)', 'B ÷ (A + B)', 'A ÷ B', 'A + B'], 0,
    'Gini = area between the line of equality and the Lorenz curve ÷ total area under the line of equality. A Lorenz curve further from the diagonal means more inequality.');

  // ---------- Calculations with fresh numbers ----------
  GEN('2.2', () => {
    const p0 = rnd(4, 12) * 5, pc = pick([10, 20, 25]), q0 = rnd(4, 20) * 50;
    const ped = pick([-0.4, -0.5, -0.8, -1.5, -2, -2.5]);
    const q1 = q0 * (1 + (ped * pc) / 100);
    return { type: 'num', q: `The price of a good rises from $${p0} to $${r2(p0 * (1 + pc / 100))}, and quantity demanded falls from ${q0} to ${r2(q1)} units per week. Calculate the price elasticity of demand (include the sign).`,
      answer: ped, tol: 0.02, explain: `%ΔQd = (${r2(q1)} - ${q0}) ÷ ${q0} × 100 = ${r2(ped * pc)}%. %ΔP = +${pc}%. PED = ${r2(ped * pc)} ÷ ${pc} = ${ped}. ${Math.abs(ped) < 1 ? 'Inelastic, so revenue rises when price rises.' : 'Elastic, so revenue falls when price rises.'}` };
  });
  GEN('2.2', () => {
    const yc = pick([5, 8, 10, 20]), yed = pick([-0.5, 0.4, 0.8, 1.5, 2]);
    const qc = r2(yed * yc);
    return { type: 'num', q: `Average income rises by ${yc}%. Demand for a good changes by ${qc > 0 ? '+' : ''}${qc}%. Calculate the income elasticity of demand.`,
      answer: yed, tol: 0.02, explain: `YED = %ΔQd ÷ %ΔY = ${qc} ÷ ${yc} = ${yed}. ${yed < 0 ? 'Negative: an inferior good.' : yed > 1 ? 'Greater than 1: a normal luxury good.' : 'Between 0 and 1: a normal necessity.'}` };
  });
  GEN('2.2', () => {
    const pc = pick([10, 20, 25]), xed = pick([-0.6, -1.2, 0.3, 0.5, 1.4]);
    const qc = r2(xed * pc);
    return { type: 'num', q: `The price of good Y rises by ${pc}%. Demand for good X changes by ${qc > 0 ? '+' : ''}${qc}%. Calculate the cross elasticity of demand for X with respect to the price of Y.`,
      answer: xed, tol: 0.02, explain: `XED = %ΔQd of X ÷ %ΔP of Y = ${qc} ÷ ${pc} = ${xed}. ${xed > 0 ? 'Positive: substitutes.' : 'Negative: complements.'}` };
  });
  GEN('2.3', () => {
    const pc = pick([10, 20, 25, 40]), pes = pick([0.2, 0.5, 1.5, 2]);
    const qc = r2(pes * pc);
    return { type: 'num', q: `Price rises by ${pc}% and quantity supplied rises by ${qc}%. Calculate the price elasticity of supply.`,
      answer: pes, tol: 0.02, explain: `PES = %ΔQs ÷ %ΔP = ${qc} ÷ ${pc} = ${pes}. ${pes < 1 ? 'Inelastic supply.' : 'Elastic supply.'}` };
  });
  GEN('1.1', () => {
    const w = rnd(8, 20), h = rnd(2, 5);
    return { type: 'num', q: `Aisha can work ${h} hours at $${w} per hour or spend the time studying. In money terms, what is the opportunity cost ($) of studying?`,
      answer: w * h, tol: 0.01, explain: `The next best alternative is the wage given up: ${h} × $${w} = $${w * h}.` };
  });
  GEN('4.1', () => {
    const n = rnd(400, 900), idx = rnd(105, 130);
    const real = r2((n / idx) * 100);
    return { type: 'num', q: `Nominal GDP is $${n}bn. The price index (base year = 100) is ${idx}. Calculate real GDP in base-year prices ($bn, 2 d.p.).`,
      answer: real, tol: 0.05, explain: `Real GDP = nominal GDP ÷ price index × 100 = ${n} ÷ ${idx} × 100 = $${real}bn.` };
  });
  GEN('4.5', () => {
    const lf = rnd(20, 60) * 1000, u = rnd(8, 40) * 100;
    const rate = r2((u / lf) * 100);
    return { type: 'num', q: `A country has ${lf.toLocaleString()} people in the labour force, of whom ${u.toLocaleString()} are unemployed. Calculate the unemployment rate (%).`,
      answer: rate, tol: 0.05, explain: `Unemployment rate = ${u} ÷ ${lf} × 100 = ${rate}%.` };
  });
  GEN('4.6', () => {
    const w = [pick([20, 30, 40]), 0, 0]; w[1] = pick([30, 40]); w[2] = 100 - w[0] - w[1];
    const c = [pick([2, 4, 5, 10]), pick([-2, 0, 3, 6]), pick([1, 5, 8])];
    const inf = r2((w[0] * c[0] + w[1] * c[1] + w[2] * c[2]) / 100);
    return { type: 'num', q: `A price index has three items. Food (weight ${w[0]}) rises ${c[0]}%, transport (weight ${w[1]}) changes ${c[1]}%, housing (weight ${w[2]}) rises ${c[2]}%. Weights total 100. Calculate the inflation rate (%).`,
      answer: inf, tol: 0.02, explain: `Weighted average = (${w[0]}×${c[0]} + ${w[1]}×${c[1]} + ${w[2]}×${c[2]}) ÷ 100 = ${inf}%.` };
  });
  GEN('6.1', () => {
    const xp = rnd(95, 130), mp = rnd(95, 130);
    const tot = r2((xp / mp) * 100);
    return { type: 'num', q: `The export price index is ${xp} and the import price index is ${mp}. Calculate the terms of trade (2 d.p.).`,
      answer: tot, tol: 0.05, explain: `Terms of trade = ${xp} ÷ ${mp} × 100 = ${tot}. ${tot > 100 ? 'Above 100: favourable compared with the base year.' : 'Below 100: unfavourable compared with the base year.'}` };
  });
  GEN('6.3', () => {
    const g = rnd(-60, 20), s = rnd(-10, 40), p = rnd(-20, 10), sec = rnd(-10, 15);
    const ca = g + s + p + sec;
    return { type: 'num', q: `Trade in goods balance: $${g}bn. Trade in services: $${s}bn. Primary income: $${p}bn. Secondary income: $${sec}bn. Calculate the current account balance ($bn; negative for a deficit).`,
      answer: ca, tol: 0.01, explain: `Current account = goods + services + primary income + secondary income = ${g} + ${s} + ${p} + ${sec} = ${ca}. ${ca < 0 ? 'A deficit.' : 'A surplus.'}` };
  });

  // ---------- Paper 2 style data response and essays (self-marked) ----------
  P2('2.2', `<b>Data response (style).</b> The price of bus fares in a city rose by 20%, and the number of bus journeys fell by 6%. Over the same period, taxi journeys rose by 9%.<br><br>(a) Calculate the price elasticity of demand for bus journeys. [2]<br>(b) Using the data, explain whether bus and taxi journeys are substitutes or complements. [2]<br>(c) Explain two factors that may make the demand for bus journeys price inelastic. [4]`,
    ['(a) PED = -6 ÷ 20 = -0.3 (inelastic)', '(b) Substitutes: bus price rose and demand for taxis rose; XED would be positive', '(c) Factor 1 explained, e.g. few close substitutes for commuters on low incomes', '(c) Factor 2 explained, e.g. necessity / habit for getting to work or school', '(c) Link each factor to a small % change in quantity relative to price'],
    'PED = %ΔQd ÷ %ΔP = -6 ÷ 20 = -0.3. The taxi figure implies positive XED (substitutes). Demand is inelastic because many passengers have no car, bus travel is a necessity for work, and fares may be a small proportion of income.');
  P2('3.2', `<b>Essay.</b> (a) With the help of a diagram, explain how an indirect tax affects the market for a demerit good. [8]<br>(b) Discuss whether an indirect tax is the best way for a government to reduce the consumption of a demerit good. [12]`,
    ['(a) Define demerit good: over-consumed, harmful; information failure', '(a) Accurate diagram: S shifts vertically up by the tax; new P and Q labelled', '(a) Explain price rises, quantity falls; incidence depends on PED', '(b) Advantage: raises price, cuts consumption, raises revenue that can fund health care / campaigns', '(b) Limitation: demand is often price inelastic (addictive), so consumption falls little', '(b) Limitation: regressive; may create black markets / smuggling', '(b) Compare with alternatives: regulation/ban, information campaigns, age limits', '(b) Supported conclusion: "best" depends on PED, size of tax, enforcement; a mix of policies'],
    'Strong answers analyse with a labelled diagram, then evaluate using PED, equity (regressive effects), unintended consequences and alternative policies, ending with a justified judgement.');
  P2('1.4', `<b>Essay.</b> (a) Explain how the price mechanism allocates resources in a market economy. [8]<br>(b) Discuss whether a mixed economy is better than a market economy at allocating resources. [12]`,
    ['(a) Signalling function: prices show where resources are wanted', '(a) Incentive function: higher prices / profit encourage producers to supply more', '(a) Rationing function: higher prices ration scarce goods to those willing and able to pay', '(a) Use of an example or demand and supply diagram', '(b) Market failures: public goods not provided, merit goods under-consumed, demerit goods over-consumed', '(b) Inequality: markets allocate by ability to pay', '(b) Government failure: lack of information, inefficiency, bureaucracy, distorted incentives', '(b) Judgement: depends on the degree and quality of intervention'],
    'Good answers show all three functions of price, then weigh market failure against government failure.');
  P2('4.6', `<b>Essay.</b> (a) Explain the difference between demand-pull and cost-push inflation. [8]<br>(b) Discuss whether inflation is always harmful to an economy. [12]`,
    ['(a) Demand-pull: AD rises faster than AS; AD/AS diagram with AD shifting right', '(a) Cost-push: rising costs (wages, oil, import prices) shift AS left; diagram', '(a) Explain effects on output: demand-pull raises output; cost-push lowers it', '(b) Costs: falling real incomes for those on fixed incomes, menu and shoe-leather costs, lower competitiveness, uncertainty discouraging investment', '(b) Redistribution from savers/lenders to borrowers', '(b) Benefits: mild inflation may encourage spending, reduce real value of debt, avoid deflation', '(b) Depends on the rate, whether it is anticipated, and its cause', '(b) Supported conclusion'],
    'Evaluate by distinguishing low, stable, anticipated inflation from high or volatile inflation.');
  P2('5.3', `<b>Essay.</b> (a) Explain how a rise in interest rates can reduce inflation. [8]<br>(b) Discuss whether monetary policy is more effective than fiscal policy in reducing a high rate of unemployment. [12]`,
    ['(a) Higher cost of borrowing reduces consumption and investment', '(a) Higher reward for saving; mortgage payments rise, reducing disposable income', '(a) Currency may appreciate: exports fall, imports cheaper', '(a) AD falls, so demand-pull pressure on the price level eases (diagram)', '(b) Monetary: quick to change, independent central bank; but time lags and low confidence may mean borrowing does not rise', '(b) Fiscal: direct effect of government spending, can target regions/sectors; but time lags, budget deficit, crowding out', '(b) Depends on the type of unemployment: neither fixes structural unemployment well; supply-side needed', '(b) Supported conclusion'],
    'Top answers link the choice of policy to the type of unemployment and the state of the economy.');
  P2('6.2', `<b>Essay.</b> (a) Explain the theory of comparative advantage. [8]<br>(b) Discuss whether a developing economy should use protectionism to support its industries. [12]`,
    ['(a) Define comparative advantage: lower opportunity cost', '(a) Numerical or PPC example showing gains from specialisation and trade', '(a) Assumptions: no transport costs, constant costs, free trade', '(b) For: infant industry, protect jobs, government revenue from tariffs, anti-dumping', '(b) Against: higher prices for consumers, less choice, retaliation, inefficiency of protected firms', '(b) Diagram of a tariff with areas explained (optional but credited)', '(b) Judgement: temporary, targeted protection vs long-run costs'],
    'Balance the infant-industry case against efficiency losses and the risk of retaliation.');
  P2('6.5', `<b>Data response (style).</b> A country's current account deficit has grown to 6% of GDP as imports of consumer goods rise.<br><br>(a) Identify two components of the current account. [2]<br>(b) Explain one expenditure-switching and one expenditure-reducing policy to reduce the deficit. [4]<br>(c) Discuss whether a depreciation of the currency would reduce the deficit. [6]`,
    ['(a) Two of: trade in goods, trade in services, primary income, secondary income', '(b) Switching: tariffs/quotas or devaluation make imports dearer relative to domestic goods', '(b) Reducing: higher income tax / higher interest rates cut total spending, including on imports', '(c) Exports cheaper, imports dearer, so export volumes rise and import volumes fall', '(c) Depends on how price elastic demand for exports and imports is', '(c) Risks: imported inflation, time lags, retaliation; conclusion'],
    null);
  P2('4.4', `<b>Essay.</b> (a) Explain the difference between actual and potential economic growth. [8]<br>(b) Discuss whether economic growth always improves living standards. [12]`,
    ['(a) Actual growth: increase in real GDP; movement towards the PPC / towards full capacity', '(a) Potential growth: increase in productive capacity; outward PPC or AS shift', '(a) Causes of each explained', '(b) Benefits: higher incomes, employment, tax revenue for public services', '(b) Costs: pollution, depletion of resources, inequality, inflation, stress/longer hours', '(b) Real GDP per head vs population growth; distribution of the gains', '(b) Supported conclusion'],
    null);
  P2('1.2', `<b>Data response (style).</b> A report states: "Youth unemployment rose from 12% to 15% after the minimum wage increase. The government should scrap the minimum wage for workers under 21."<br><br>(a) Identify one positive and one normative statement in the report. [2]<br>(b) Explain why economists use the assumption of ceteris paribus when analysing the effect of a minimum wage. [4]`,
    ['(a) Positive: "Youth unemployment rose from 12% to 15%" (testable)', '(a) Normative: "The government should scrap..." (value judgement)', '(b) Ceteris paribus: all other things held constant', '(b) Many factors affect unemployment at once (recession, technology), so isolating the minimum wage allows its effect to be identified', '(b) Limitation: in reality other factors do change, so the data may not prove causation'],
    null);
  P2('1.3', `<b>Essay.</b> (a) Explain the four factors of production and the reward each receives. [8]<br>(b) Discuss whether specialisation and the division of labour always benefit an economy. [12]`,
    ['(a) Land: natural resources, reward rent', '(a) Labour: human effort, reward wages', '(a) Capital: man-made aids to production, reward interest', '(a) Enterprise: organises and takes risk, reward profit', '(b) Benefits: higher productivity, lower unit costs, skills develop, more output', '(b) Costs: boredom and low motivation, deskilling, over-dependence / structural unemployment if demand changes', '(b) Depends on size of market, flexibility of workers, type of product', '(b) Supported conclusion'],
    null);
  P2('1.6', `<b>Essay.</b> (a) Explain why a free market may fail to provide public goods. [8]<br>(b) Discuss whether governments should provide merit goods free of charge. [12]`,
    ['(a) Characteristics: non-rival and non-excludable', '(a) Free-rider problem: consumers will not reveal willingness to pay', '(a) Firms cannot make a profit, so the good is not provided (missing market)', '(a) Example, e.g. street lighting, national defence', '(b) For free provision: merit goods under-consumed due to information failure; equity; wider benefits to society', '(b) Against: opportunity cost / tax burden; excess demand and queues; possible inefficiency', '(b) Alternatives: subsidies, regulation (compulsory schooling), information campaigns', '(b) Supported conclusion'],
    null);
  P2('3.1', `<b>Essay.</b> (a) Explain how information failure can lead to the over-consumption of demerit goods. [8]<br>(b) Discuss whether government intervention always improves the allocation of resources. [12]`,
    ['(a) Define demerit good and information failure', '(a) Consumers underestimate the harm (to themselves) so demand is higher than it would be with full information', '(a) Over-consumption compared with the socially desirable level; example', '(b) Intervention can correct market failure: taxes, regulation, information, provision', '(b) Government failure: imperfect information, cost, unintended consequences (black markets), political motives', '(b) Evaluation of when intervention works best', '(b) Supported conclusion'],
    null);
  P2('4.2', `<b>Data response (style).</b> A country's exports rose sharply after a trade agreement, while savings and imports were unchanged.<br><br>(a) Name the three injections into the circular flow of income. [3]<br>(b) Using the circular flow of income, explain the likely effect of the rise in exports on national income. [4]`,
    ['(a) Investment, government spending, exports', '(b) Exports are an injection: more spending flows to domestic firms', '(b) Firms raise output and pay more income to households, which spend some of it', '(b) Injections now exceed withdrawals, so national income rises until they are equal again'],
    null);
  P2('5.1', `<b>Essay.</b> (a) Explain the main macroeconomic policy objectives of a government. [8]<br>(b) Discuss whether a government can achieve all of its macroeconomic objectives at the same time. [12]`,
    ['(a) Low and stable inflation', '(a) Low unemployment', '(a) Sustainable economic growth', '(a) Stable / sustainable current account position (and redistribution of income)', '(b) Conflict: lower unemployment vs inflation', '(b) Conflict: growth vs current account (imports rise with income)', '(b) Supply-side growth can achieve several at once in the long run', '(b) Supported conclusion'],
    null);
  P2('5.2', `<b>Essay.</b> (a) Explain how fiscal policy could be used to reduce unemployment. [8]<br>(b) Discuss whether a budget deficit is always harmful to an economy. [12]`,
    ['(a) Expansionary fiscal policy: higher government spending and/or lower taxes', '(a) AD increases (AD/AS diagram), firms increase output and demand for labour', '(a) Most effective for cyclical (demand-deficient) unemployment', '(b) Harms: rising national debt, interest payments, possible inflation, crowding out', '(b) Benefits: supports demand in a recession, spending on infrastructure/education raises capacity', '(b) Depends on size, duration, what it is spent on and the state of the economy', '(b) Supported conclusion'],
    null);
  P2('5.4', `<b>Essay.</b> (a) Explain two supply-side policies a government could use. [8]<br>(b) Discuss whether supply-side policies are the best way to achieve economic growth. [12]`,
    ['(a) Policy 1 explained (e.g. education and training raises labour productivity)', '(a) Policy 2 explained (e.g. deregulation, privatisation, lower direct taxes, infrastructure)', '(a) Link to an increase in productive capacity (AS or PPC shifts outward)', '(b) Strengths: long-run growth without inflation, better competitiveness', '(b) Limitations: time lags, cost, may increase inequality, results uncertain', '(b) Demand-side policies may be needed when there is spare capacity', '(b) Supported conclusion'],
    null);
})();
