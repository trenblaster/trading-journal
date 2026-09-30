// Cambridge International AS Level Accounting 9706 (AS content only).
(function () {
  const S = 'acc';
  const T = (id, name, group) => Bank.topic(S, id, name, group);
  const M = (topic, q, options, answer, explain) => Bank.add(S, { type: 'mcq', topic, q, options, answer, explain, papers: [1] });
  const GEN = (topic, make, papers) => Bank.add(S, { gen: true, topic, make, papers: papers || [1, 2] });
  const P2 = (topic, prompt, points, model) => Bank.add(S, { type: 'self', topic, prompt, points, model, papers: [2] });
  const { rnd, pick, money: $, r2 } = Bank;

  const g1 = '1 Financial accounting';
  T('a1', 'Types of business entity and sources of finance', g1);
  T('a2', 'Double entry and books of prime entry', g1);
  T('a3', 'Trial balance, errors and suspense accounts', g1);
  T('a4', 'Accounting concepts', g1);
  T('a5', 'Non-current assets and depreciation', g1);
  T('a6', 'Accruals, prepayments and irrecoverable debts', g1);
  T('a7', 'Inventory valuation', g1);
  T('a8', 'Bank reconciliation', g1);
  T('a9', 'Control accounts', g1);
  T('a11', 'Sole trader financial statements', g1);
  T('a12', 'Partnerships', g1);
  T('a13', 'Limited companies', g1);
  T('a14', 'Incomplete records', g1);
  T('a15', 'Analysis: accounting ratios', g1);
  const g2 = '2 Cost and management accounting';
  T('a16', 'Costing for materials and labour', g2);
  T('a17', 'Absorption and marginal costing', g2);

  // ---------- Paper 1 style multiple choice ----------
  M('a1', 'Which type of business entity has unlimited liability?',
    ['Sole trader', 'Private limited company', 'Public limited company', 'All companies'], 0,
    'A sole trader (and partners in an ordinary partnership) can lose personal assets to pay business debts. Shareholders\' liability is limited to their investment.');
  M('a1', 'A debenture is best described as',
    ['a long-term loan to a company, usually at a fixed rate of interest', 'a share that carries voting rights', 'a short-term bank overdraft', 'a reserve created from profits'], 0,
    'Debenture holders are lenders (creditors), not owners. Interest must be paid whether or not a profit is made; it is a non-current liability.');
  M('a1', 'Which is an advantage of a partnership over a sole trader?',
    ['More capital and shared skills', 'Limited liability for all partners', 'No need to share profit', 'Decisions are always quicker'], 0,
    'Partners can bring in more capital and expertise, but profits must be shared and there may be disagreements.');
  M('a2', 'Goods are bought on credit from K Lee. Which entry is correct?',
    ['Debit purchases, credit K Lee', 'Debit K Lee, credit purchases', 'Debit purchases, credit cash', 'Debit inventory, credit sales'], 0,
    'Purchases (an expense) increases with a debit; the supplier is now owed money, so their account is credited.');
  M('a2', 'The owner takes goods from the business for personal use. What is the double entry?',
    ['Debit drawings, credit purchases', 'Debit purchases, credit drawings', 'Debit capital, credit sales', 'Debit drawings, credit sales'], 0,
    'Goods taken reduce purchases (credit) and are treated as drawings (debit).');
  M('a2', 'In which book of prime entry would the credit purchase of a non-current asset be recorded first?',
    ['The journal', 'Purchases journal', 'Cash book', 'Sales journal'], 0,
    'The purchases journal records only credit purchases of goods for resale. Other non-routine items go in the (general) journal.');
  M('a2', 'Which account normally has a credit balance?',
    ['Trade payables', 'Drawings', 'Rent expense', 'Machinery'], 0,
    'Liabilities, capital and income have credit balances. Assets, expenses and drawings have debit balances.');
  M('a2', 'Discount allowed of $30 is given to a credit customer. What is the double entry?',
    ['Debit discount allowed, credit trade receivable (customer)', 'Debit customer, credit discount allowed', 'Debit discount received, credit customer', 'Debit sales, credit discount allowed'], 0,
    'Discount allowed is an expense (debit). The customer owes less (credit their account). Trade discounts are not recorded in the ledger.');
  M('a2', 'Which is a correct form of the accounting equation?',
    ['Assets = Capital + Liabilities', 'Assets + Liabilities = Capital', 'Capital = Assets + Liabilities', 'Liabilities = Assets + Capital'], 0,
    'Everything the business owns is financed by the owner (capital) or by others (liabilities).');
  M('a3', 'A credit sale to J Smith was posted to J Smyth\'s account. What type of error is this?',
    ['Error of commission', 'Error of principle', 'Error of omission', 'Compensating error'], 0,
    'Correct class of account, wrong person\'s account: commission. It does not affect the trial balance totals.');
  M('a3', 'The purchase of a delivery van was debited to motor expenses. This is an error of',
    ['principle', 'commission', 'original entry', 'complete reversal'], 0,
    'Capital expenditure was recorded as revenue expenditure: the wrong class of account.');
  M('a3', 'Which error would cause the trial balance totals to disagree?',
    ['Discount allowed of $50 entered on the credit side of discount allowed account and correctly in the customer\'s account', 'A sale omitted from the books completely', 'Wages paid debited to the rent account', 'A purchase invoice recorded as $540 instead of $450 in both accounts'], 0,
    'Both entries were credits, so the debit side is short by $100 (2 × $50). The others are errors of omission, commission and original entry, which do not affect totals.');
  M('a3', 'The trial balance debit total is $250 more than the credit total. How is a suspense account opened?',
    ['With a credit balance of $250', 'With a debit balance of $250', 'With a credit balance of $125', 'It is not needed'], 0,
    'The suspense account is placed on the smaller side (credit) to make the totals agree.');
  M('a3', 'Which of these does NOT affect the agreement of the trial balance?',
    ['A compensating error', 'A single-sided entry', 'A casting error in one account', 'Two debit entries for one transaction'], 0,
    'Compensating errors cancel each other out, so totals still agree.');
  M('a4', 'Which concept states that the business is treated separately from its owner?',
    ['Business entity', 'Going concern', 'Prudence', 'Consistency'], 0,
    'The owner\'s personal transactions are not recorded in the business accounts (except as capital and drawings).');
  M('a4', 'Expenses are matched against the revenue of the period they relate to, not when cash is paid. This is the',
    ['accruals (matching) concept', 'realisation concept', 'money measurement concept', 'historical cost concept'], 0,
    'Accruals: record income and expenses when they are earned or incurred.');
  M('a4', 'A business values inventory at the lower of cost and net realisable value. Which concept is applied?',
    ['Prudence', 'Materiality', 'Duality', 'Going concern'], 0,
    'Prudence avoids overstating assets and profits.');
  M('a4', 'A business uses the straight-line method of depreciation every year for its vehicles. This follows the',
    ['consistency concept', 'going concern concept', 'realisation concept', 'business entity concept'], 0,
    'Consistency allows meaningful comparison between periods.');
  M('a4', 'Revenue is recognised when goods pass to the customer, not when the order is received. This is the',
    ['realisation concept', 'prudence concept', 'accruals concept', 'money measurement concept'], 0,
    'Realisation: revenue is recognised when it is earned and legally due.');
  M('a4', 'Assets are valued on the assumption that the business will continue trading. This is the',
    ['going concern concept', 'business entity concept', 'consistency concept', 'duality concept'], 0,
    'If the business were closing, assets would be valued at what they could be sold for.');
  M('a5', 'Which is capital expenditure?',
    ['Legal costs of buying new premises', 'Repairs to the roof', 'Fuel for delivery vans', 'Insurance of machinery'], 0,
    'Costs of acquiring a non-current asset and getting it ready for use are capitalised. Repairs, fuel and insurance are revenue expenditure.');
  M('a5', 'A machine is sold for less than its carrying amount. What is the result?',
    ['A loss on disposal', 'A profit on disposal', 'No effect on profit', 'An increase in capital reserves'], 0,
    'Carrying amount = cost - accumulated depreciation. Proceeds below this give a loss, charged in the income statement.');
  M('a5', 'Which depreciation method charges a fixed percentage of the carrying amount each year?',
    ['Reducing balance', 'Straight line', 'Revaluation', 'Units of output'], 0,
    'Reducing (diminishing) balance gives higher charges in early years.');
  M('a5', 'When a non-current asset is sold, the accumulated depreciation on it is transferred to the',
    ['disposal account (credit)', 'disposal account (debit)', 'income statement (debit)', 'asset account (credit)'], 0,
    'Debit provision for depreciation, credit disposal. The asset cost is debited to disposal.');
  M('a6', 'Rent of $6000 was paid in the year, including $1000 for the next year. What is the rent expense?',
    ['$5000', '$6000', '$7000', '$1000'], 0,
    'The $1000 prepayment is a current asset and is excluded from this year\'s expense.');
  M('a6', 'At the year end, electricity of $400 is owing. How is this shown in the statement of financial position?',
    ['As a current liability (other payables / accrual)', 'As a current asset', 'As a non-current liability', 'It is not shown'], 0,
    'Accrued expenses are current liabilities; the expense in the income statement is increased by $400.');
  M('a6', 'A customer owing $500 is declared bankrupt. What is the entry to write off the debt?',
    ['Debit irrecoverable debts, credit trade receivables', 'Debit trade receivables, credit irrecoverable debts', 'Debit sales, credit trade receivables', 'Debit allowance for doubtful debts, credit sales'], 0,
    'The irrecoverable debt is an expense, and the receivable is removed.');
  M('a6', 'The allowance for doubtful debts is increased. What is the effect on profit for the year?',
    ['Profit decreases by the increase', 'Profit increases by the increase', 'Profit decreases by the whole allowance', 'No effect'], 0,
    'Only the change in the allowance is charged (increase) or credited (decrease) to the income statement.');
  M('a7', 'Inventory should be valued at',
    ['the lower of cost and net realisable value', 'selling price', 'replacement cost', 'the higher of cost and net realisable value'], 0,
    'IAS 2 Inventories. Net realisable value = estimated selling price - costs to complete and sell.');
  M('a7', 'Goods cost $800. They can be sold for $900 after repairs costing $250. At what value should they be included in inventory?',
    ['$650', '$800', '$900', '$1150'], 0,
    'NRV = $900 - $250 = $650, which is lower than cost $800.');
  M('a7', 'When prices are rising, FIFO compared with AVCO gives',
    ['higher closing inventory and higher profit', 'lower closing inventory and lower profit', 'the same profit', 'lower closing inventory and higher profit'], 0,
    'FIFO issues the older, cheaper units first, so the remaining (closing) inventory is valued at recent, higher prices and cost of sales is lower.');
  M('a8', 'Which item would appear in the bank statement but not yet in the cash book?',
    ['Bank charges', 'Unpresented cheques', 'Outstanding lodgements', 'Cheques paid to suppliers'], 0,
    'Bank charges, direct debits, credit transfers and dishonoured cheques must be entered in the cash book before the reconciliation.');
  M('a8', 'An unpresented cheque is a cheque that',
    ['has been recorded in the cash book but not yet cleared by the bank', 'has been dishonoured', 'the bank has paid but the business has not recorded', 'has been received but not banked'], 0,
    'In the reconciliation starting from the bank statement balance, unpresented cheques are deducted.');
  M('a8', 'A credit balance in the bank column of the cash book means',
    ['the business has an overdraft', 'the business has money in the bank', 'the bank owes the business money', 'there is an error'], 0,
    'In the business\'s cash book, a credit balance on bank means the bank is owed money (overdraft).');
  M('a9', 'Which item is NOT entered in the sales ledger control account?',
    ['Cash sales', 'Credit sales', 'Discounts allowed', 'Returns inwards'], 0,
    'Cash sales never create a trade receivable, so they do not appear in the sales ledger control account.');
  M('a9', 'In a purchases ledger control account, a contra (set-off) against the sales ledger is entered on the',
    ['debit side', 'credit side', 'either side', 'it is not recorded'], 0,
    'A set-off reduces the amount owed to the supplier (debit PLCA) and the amount owed by the same person as a customer (credit SLCA).');
  M('a9', 'Which is a purpose of control accounts?',
    ['To help locate errors in the ledgers', 'To record cash sales', 'To calculate depreciation', 'To replace the trial balance'], 0,
    'They check the arithmetical accuracy of the personal ledgers, help locate errors, and give a quick total of receivables and payables.');
  M('a11', 'Carriage inwards is treated as',
    ['part of cost of sales', 'an expense below gross profit', 'income', 'a current liability'], 0,
    'Carriage inwards is part of the cost of purchases. Carriage outwards is a selling expense.');
  M('a11', 'Which formula is correct?',
    ['Cost of sales = opening inventory + purchases - closing inventory', 'Cost of sales = purchases - opening inventory', 'Gross profit = revenue - expenses', 'Profit = gross profit + expenses'], 0,
    'Net purchases also adjust for carriage inwards and returns outwards.');
  M('a11', 'In the statement of financial position of a sole trader, drawings are',
    ['deducted from capital', 'added to capital', 'shown as an expense', 'shown as a current asset'], 0,
    'Closing capital = opening capital + capital introduced + profit - drawings.');
  M('a12', 'In the absence of a partnership agreement, which rule applies?',
    ['Profits and losses are shared equally', 'Partners receive salaries', 'Interest is paid on capital', 'Profits are shared in the ratio of capital'], 0,
    'With no agreement: equal profit sharing, no interest on capital, no salaries, no interest on drawings, and 5% per year interest on partners\' loans.');
  M('a12', 'Interest on drawings in a partnership appropriation account is',
    ['added to the profit available for sharing', 'deducted from profit', 'an expense in the income statement', 'credited to the partner\'s current account'], 0,
    'Interest on drawings is charged to the partner (debit their current account) and adds to the residual profit.');
  M('a12', 'Where are partners\' salaries recorded?',
    ['Appropriation account and credited to current accounts', 'Income statement as an expense', 'Debited to current accounts', 'Capital accounts only'], 0,
    'Partners\' salaries are an appropriation of profit, not an expense of the business.');
  M('a12', 'When a new partner is admitted and goodwill is not to be kept in the books, goodwill is',
    ['credited to old partners in the old ratio and debited to all partners in the new ratio', 'debited to the new partner only', 'shown as a current asset', 'credited to all partners in the new ratio'], 0,
    'This adjusts capital so that old partners are rewarded for goodwill they built up.');
  M('a13', 'Which is a revenue reserve?',
    ['Retained earnings', 'Share premium', 'Revaluation reserve', 'Ordinary share capital'], 0,
    'Revenue reserves (retained earnings, general reserve) come from trading profits and can be distributed as dividends. Share premium and revaluation reserve are capital reserves.');
  M('a13', 'A bonus issue of shares',
    ['converts reserves into share capital without any cash being received', 'raises cash from existing shareholders', 'is a dividend paid in cash', 'reduces total equity'], 0,
    'Total equity is unchanged; reserves become share capital. A rights issue raises cash.');
  M('a13', 'Shares with a nominal value of $1 are issued at $1.50. The extra $0.50 per share is credited to',
    ['the share premium account', 'retained earnings', 'the income statement', 'the general reserve'], 0,
    'Share premium is a capital reserve and cannot be used to pay cash dividends.');
  M('a13', 'Where are ordinary dividends paid during the year shown?',
    ['Statement of changes in equity', 'Income statement as an expense', 'As a current asset', 'Cost of sales'], 0,
    'Dividends are a distribution of profit to owners, not an expense.');
  M('a14', 'A trader uses a mark-up of 25%. What is the gross margin?',
    ['20%', '25%', '33⅓%', '75%'], 0,
    'Mark-up 25% means cost 100, profit 25, selling price 125. Margin = 25 ÷ 125 = 20%.');
  M('a14', 'A statement of affairs is used to calculate',
    ['capital (net assets) at a point in time', 'profit on disposal', 'cash flow', 'cost of sales'], 0,
    'Capital = assets - liabilities. Comparing opening and closing capital (adjusting for drawings and capital introduced) gives profit.');
  M('a15', 'The current ratio is',
    ['current assets ÷ current liabilities', '(current assets - inventory) ÷ current liabilities', 'current liabilities ÷ current assets', 'non-current assets ÷ current liabilities'], 0,
    'It measures liquidity: the ability to pay short-term debts.');
  M('a15', 'Which ratio excludes inventory?',
    ['Liquid (acid test) ratio', 'Current ratio', 'Gross margin', 'Return on capital employed'], 0,
    'Inventory is the least liquid current asset, so the liquid ratio removes it.');
  M('a15', 'Trade receivables turnover rises from 35 days to 58 days. This suggests',
    ['credit control has weakened', 'customers are paying faster', 'the business is more liquid', 'inventory is selling faster'], 0,
    'Customers are taking longer to pay, which can cause cash flow problems.');
  M('a15', 'Which is a limitation of ratio analysis?',
    ['Ratios are based on historical data', 'Ratios can compare performance over time', 'Ratios help users make decisions', 'Ratios allow inter-firm comparison'], 0,
    'Ratios use past figures, can be affected by different accounting policies, and ignore non-financial factors.');
  M('a16', 'Workers paid a fixed amount for each unit produced are paid by',
    ['piece rate', 'time rate', 'salary', 'overtime premium'], 0,
    'Piece rate encourages output but may reduce quality.');
  M('a16', 'Which method of pricing issues of materials uses a new weighted average after each receipt?',
    ['AVCO', 'FIFO', 'LIFO', 'Standard cost'], 0,
    'Periodic or perpetual AVCO recalculates cost per unit when new inventory is received.');
  M('a17', 'Which cost is a direct cost of making a table?',
    ['Wood used in the table', 'Factory rent', 'Supervisor\'s salary', 'Depreciation of machinery'], 0,
    'Direct costs can be traced to a specific unit. The others are production overheads.');
  M('a17', 'Overheads were over-absorbed. This means',
    ['overheads absorbed were greater than actual overheads', 'actual overheads were greater than absorbed', 'the OAR was too low', 'profit must be reduced'], 0,
    'Over-absorption is credited to (increases) profit. Under-absorption is debited.');
  M('a17', 'Apportionment of overheads means',
    ['sharing an overhead between cost centres on a fair basis', 'charging a whole overhead to one cost centre', 'charging overheads to units', 'ignoring fixed costs'], 0,
    'E.g. rent apportioned by floor area. Allocation charges a cost wholly to one cost centre; absorption charges overheads to units.');
  M('a17', 'Contribution per unit is',
    ['selling price - variable cost per unit', 'selling price - total cost per unit', 'fixed costs ÷ units', 'profit ÷ units'], 0,
    'Contribution goes first to cover fixed costs, then to profit.');
  M('a17', 'Closing inventory rises during the year. Compared with marginal costing, absorption costing profit will be',
    ['higher', 'lower', 'the same', 'impossible to compare'], 0,
    'Absorption costing carries some fixed overheads forward in closing inventory, so less is charged this year.');

  // ---------- Calculations with fresh numbers (Paper 1 and Paper 2) ----------
  GEN('a5', () => {
    const cost = rnd(20, 90) * 1000, res = rnd(1, 8) * 1000, yrs = pick([4, 5, 8, 10]);
    const ans = (cost - res) / yrs;
    return { type: 'num', q: `A machine costs ${$(cost)}. It has an expected life of ${yrs} years and a residual value of ${$(res)}. Calculate the annual straight-line depreciation ($).`,
      answer: ans, tol: 0.5, explain: `(${$(cost)} - ${$(res)}) ÷ ${yrs} = ${$(ans)} per year.` };
  });
  GEN('a5', () => {
    const cost = rnd(10, 60) * 1000, rate = pick([10, 20, 25, 30]);
    const y1 = cost * rate / 100, y2 = (cost - y1) * rate / 100;
    return { type: 'num', q: `A vehicle costs ${$(cost)} and is depreciated at ${rate}% per year using the reducing balance method. Calculate the depreciation charge for Year 2 ($).`,
      answer: y2, tol: 0.5, explain: `Year 1: ${rate}% × ${$(cost)} = ${$(y1)}. Carrying amount ${$(cost - y1)}. Year 2: ${rate}% × ${$(cost - y1)} = ${$(y2)}.` };
  });
  GEN('a5', () => {
    const cost = rnd(20, 80) * 1000, acc = Math.round(cost * rnd(30, 70) / 100 / 100) * 100, proc = Math.round((cost - acc) * rnd(70, 130) / 100 / 100) * 100;
    const pl = proc - (cost - acc);
    return { type: 'num', q: `A non-current asset that cost ${$(cost)} with accumulated depreciation of ${$(acc)} is sold for ${$(proc)}. Calculate the profit (+) or loss (-) on disposal ($).`,
      answer: pl, tol: 0.5, explain: `Carrying amount = ${$(cost)} - ${$(acc)} = ${$(cost - acc)}. Proceeds ${$(proc)} - ${$(cost - acc)} = ${pl >= 0 ? 'profit of ' + $(pl) : 'loss of ' + $(-pl)}.` };
  });
  GEN('a6', () => {
    const paid = rnd(30, 90) * 100, open = rnd(2, 8) * 100, close = rnd(2, 8) * 100;
    const kind = pick(['accrued', 'prepaid']);
    const exp = kind === 'accrued' ? paid - open + close : paid + open - close;
    return { type: 'num', q: kind === 'accrued'
        ? `During the year a business paid ${$(paid)} for electricity. At the start of the year ${$(open)} was owing; at the end ${$(close)} was owing. Calculate the electricity expense for the income statement ($).`
        : `During the year a business paid ${$(paid)} for insurance. At the start of the year ${$(open)} had been prepaid; at the end ${$(close)} was prepaid. Calculate the insurance expense for the income statement ($).`,
      answer: exp, tol: 0.5,
      explain: kind === 'accrued' ? `Expense = paid - opening accrual + closing accrual = ${paid} - ${open} + ${close} = ${$(exp)}.` : `Expense = paid + opening prepayment - closing prepayment = ${paid} + ${open} - ${close} = ${$(exp)}.` };
  });
  GEN('a6', () => {
    const rec = rnd(20, 60) * 1000, pct = pick([2, 3, 4, 5]), old = rnd(3, 20) * 100;
    const nw = rec * pct / 100, ch = nw - old;
    return { type: 'num', q: `Trade receivables at the year end are ${$(rec)}. The allowance for doubtful debts is to be ${pct}% of trade receivables. The existing allowance is ${$(old)}. Calculate the amount charged (+) or credited (-) to the income statement ($).`,
      answer: ch, tol: 0.5, explain: `New allowance = ${pct}% × ${$(rec)} = ${$(nw)}. Change = ${$(nw)} - ${$(old)} = ${ch >= 0 ? 'increase of ' + $(ch) + ' (expense)' : 'decrease of ' + $(-ch) + ' (income)'}.` };
  });
  GEN('a11', () => {
    const oi = rnd(5, 15) * 1000, pur = rnd(50, 120) * 1000, ci = rnd(1, 5) * 100, ro = rnd(1, 9) * 100, ci2 = rnd(5, 15) * 1000;
    const cos = oi + pur + ci - ro - ci2;
    return { type: 'num', q: `Opening inventory ${$(oi)}; purchases ${$(pur)}; carriage inwards ${$(ci)}; returns outwards ${$(ro)}; closing inventory ${$(ci2)}. Calculate cost of sales ($).`,
      answer: cos, tol: 0.5, explain: `${oi} + ${pur} + ${ci} - ${ro} - ${ci2} = ${$(cos)}. Carriage outwards (if any) is an expense, not part of cost of sales.` };
  });
  GEN('a11', () => {
    const oc = rnd(40, 90) * 1000, pr = rnd(10, 40) * 1000, dr = rnd(5, 20) * 1000, ci = pick([0, 5000, 10000]);
    const cc = oc + ci + pr - dr;
    return { type: 'num', q: `Opening capital ${$(oc)}. Capital introduced ${$(ci)}. Profit for the year ${$(pr)}. Drawings ${$(dr)}. Calculate closing capital ($).`,
      answer: cc, tol: 0.5, explain: `${oc} + ${ci} + ${pr} - ${dr} = ${$(cc)}.` };
  });
  GEN('a12', () => {
    const profit = rnd(60, 150) * 1000, capA = rnd(4, 10) * 10000, capB = rnd(2, 8) * 10000, ioc = pick([5, 6, 8, 10]), salB = rnd(8, 15) * 1000;
    const r = pick([[3, 2], [2, 1], [1, 1]]);
    const resid = profit - (capA + capB) * ioc / 100 - salB;
    const shareA = resid * r[0] / (r[0] + r[1]);
    return { type: 'num', q: `A and B are partners. Profit for the year ${$(profit)}. Interest on capital ${ioc}% (A capital ${$(capA)}, B capital ${$(capB)}). B receives a salary of ${$(salB)}. Residual profit is shared A:B ${r[0]}:${r[1]}. Calculate A's share of the residual profit ($).`,
      answer: r2(shareA), tol: 1, explain: `Interest on capital = ${ioc}% × (${capA} + ${capB}) = ${$((capA + capB) * ioc / 100)}. Residual = ${profit} - ${(capA + capB) * ioc / 100} - ${salB} = ${$(resid)}. A = ${r[0]}/${r[0] + r[1]} × ${$(resid)} = ${$(r2(shareA))}.` };
  });
  GEN('a14', () => {
    const cos = rnd(40, 120) * 1000, mu = pick([20, 25, 40, 50]);
    const rev = cos * (1 + mu / 100);
    return { type: 'num', q: `Cost of sales is ${$(cos)}. The business uses a mark-up of ${mu}%. Calculate revenue ($).`,
      answer: rev, tol: 0.5, explain: `Revenue = cost × (100 + ${mu})% = ${$(cos)} × ${1 + mu / 100} = ${$(rev)}. Margin would be ${r2(mu / (100 + mu) * 100)}%.` };
  });
  GEN('a14', () => {
    const on = rnd(40, 90) * 1000, cn = on + rnd(-5, 30) * 1000, dr = rnd(8, 20) * 1000, ci = pick([0, 5000]);
    const p = cn - on + dr - ci;
    return { type: 'num', q: `Net assets were ${$(on)} at the start of the year and ${$(cn)} at the end. Drawings were ${$(dr)} and capital introduced was ${$(ci)}. Calculate profit for the year ($).`,
      answer: p, tol: 0.5, explain: `Profit = closing capital - opening capital + drawings - capital introduced = ${cn} - ${on} + ${dr} - ${ci} = ${$(p)}.` };
  });
  GEN('a15', () => {
    const rev = rnd(100, 400) * 1000, gp = Math.round(rev * rnd(20, 45) / 100 / 1000) * 1000;
    const gm = r2(gp / rev * 100);
    return { type: 'num', q: `Revenue ${$(rev)}; gross profit ${$(gp)}. Calculate the gross margin (%, 2 d.p.).`,
      answer: gm, tol: 0.02, explain: `Gross margin = gross profit ÷ revenue × 100 = ${gp} ÷ ${rev} × 100 = ${gm}%.` };
  });
  GEN('a15', () => {
    const inv = rnd(5, 30) * 1000, rec = rnd(5, 30) * 1000, cash = rnd(1, 10) * 1000, cl = rnd(10, 40) * 1000;
    const which = pick(['current', 'liquid']);
    const ans = which === 'current' ? r2((inv + rec + cash) / cl) : r2((rec + cash) / cl);
    return { type: 'num', q: `Inventory ${$(inv)}; trade receivables ${$(rec)}; cash ${$(cash)}; current liabilities ${$(cl)}. Calculate the ${which} ratio (x : 1, 2 d.p.).`,
      answer: ans, tol: 0.015, explain: which === 'current' ? `(${inv} + ${rec} + ${cash}) ÷ ${cl} = ${ans} : 1.` : `(${rec} + ${cash}) ÷ ${cl} = ${ans} : 1 (inventory excluded).` };
  });
  GEN('a15', () => {
    const cs = rnd(100, 500) * 1000, rec = rnd(10, 60) * 1000;
    const days = r2(rec / cs * 365);
    return { type: 'num', q: `Credit sales for the year were ${$(cs)}. Trade receivables at the year end were ${$(rec)}. Calculate trade receivables turnover in days (2 d.p.).`,
      answer: days, tol: 0.1, explain: `${rec} ÷ ${cs} × 365 = ${days} days.` };
  });
  GEN('a15', () => {
    const pfo = rnd(10, 60) * 1000, ce = rnd(100, 400) * 1000;
    const roce = r2(pfo / ce * 100);
    return { type: 'num', q: `Profit from operations ${$(pfo)}; capital employed ${$(ce)}. Calculate return on capital employed (%, 2 d.p.).`,
      answer: roce, tol: 0.02, explain: `ROCE = profit from operations ÷ capital employed × 100 = ${roce}%.` };
  });
  GEN('a8', () => {
    const cb = rnd(10, 60) * 100, ch = rnd(1, 9) * 10, dd = rnd(5, 30) * 10, ct = rnd(10, 50) * 10;
    const upd = cb - ch - dd + ct;
    return { type: 'num', q: `The cash book shows a debit bank balance of ${$(cb)}. The bank statement shows bank charges ${$(ch)}, a direct debit ${$(dd)} and a credit transfer from a customer ${$(ct)} not yet in the cash book. Calculate the updated cash book balance ($).`,
      answer: upd, tol: 0.5, explain: `${cb} - ${ch} - ${dd} + ${ct} = ${$(upd)} (debit).` };
  });
  GEN('a8', () => {
    const bs = rnd(10, 60) * 100, up = rnd(2, 15) * 100, ol = rnd(2, 15) * 100;
    const cb = bs - up + ol;
    return { type: 'num', q: `The bank statement shows a balance of ${$(bs)} in favour of the business. There are unpresented cheques of ${$(up)} and outstanding lodgements of ${$(ol)}. What should the (updated) cash book balance be ($)?`,
      answer: cb, tol: 0.5, explain: `Bank statement ${bs} - unpresented cheques ${up} + outstanding lodgements ${ol} = ${$(cb)}.` };
  });
  GEN('a9', () => {
    const ob = rnd(10, 40) * 1000, cs = rnd(50, 150) * 1000, rec = rnd(40, 140) * 1000, da = rnd(5, 20) * 100, ri = rnd(5, 30) * 100, id = rnd(2, 10) * 100, dis = rnd(2, 10) * 100;
    const cbal = ob + cs + dis - rec - da - ri - id;
    return { type: 'num', q: `Sales ledger control: opening balance ${$(ob)}; credit sales ${$(cs)}; dishonoured cheques ${$(dis)}; cash and cheques received ${$(rec)}; discounts allowed ${$(da)}; returns inwards ${$(ri)}; irrecoverable debts ${$(id)}. Calculate the closing debit balance ($).`,
      answer: cbal, tol: 0.5, explain: `Debits ${ob} + ${cs} + ${dis} = ${ob + cs + dis}. Credits ${rec} + ${da} + ${ri} + ${id} = ${rec + da + ri + id}. Balance = ${$(cbal)}.` };
  });
  GEN('a3', () => {
    const a = rnd(2, 9) * 10;
    return { type: 'num', q: `Discount received of ${$(a)} was debited to the discount received account (the supplier's account was correctly debited). By how much will the trial balance debit total exceed the credit total ($)?`,
      answer: 2 * a, tol: 0.5, explain: `The ${$(a)} should have been a credit. It was entered as a debit, so debits are overstated by ${$(a)} and credits understated by ${$(a)}: difference ${$(2 * a)}.` };
  });
  GEN('a16', () => {
    const q1 = rnd(2, 6) * 50, p1 = rnd(4, 8), q2 = rnd(2, 6) * 50, p2 = p1 + rnd(1, 3), iss = q1 + rnd(1, q2 / 50 - 1) * 50;
    const left = q1 + q2 - iss, fifo = left * p2;
    return { type: 'num', q: `Receipts: ${q1} units at $${p1}, then ${q2} units at $${p2}. Then ${iss} units are issued. Using FIFO, calculate the value of closing inventory ($).`,
      answer: fifo, tol: 0.5, explain: `FIFO issues the oldest first: all ${q1} units at $${p1}, then ${iss - q1} at $${p2}. The ${left} units left are from the latest receipt: ${left} × $${p2} = ${$(fifo)}.` };
  });
  GEN('a16', () => {
    const q1 = rnd(2, 6) * 100, p1 = rnd(4, 8), q2 = rnd(2, 6) * 100, p2 = p1 + rnd(1, 3);
    const avg = r2((q1 * p1 + q2 * p2) / (q1 + q2));
    return { type: 'num', q: `Opening inventory ${q1} units at $${p1}. Receipt ${q2} units at $${p2}. Using AVCO, calculate the cost per unit of the next issue ($, 2 d.p.).`,
      answer: avg, tol: 0.01, explain: `(${q1} × ${p1} + ${q2} × ${p2}) ÷ ${q1 + q2} = $${avg}.` };
  });
  GEN('a16', () => {
    const units = rnd(200, 600), rate = pick([0.5, 0.8, 1.2, 1.5]), hrs = 38, hr = rnd(8, 14);
    const piece = r2(units * rate), time = hrs * hr;
    return { type: 'num', q: `A worker produces ${units} units in a ${hrs}-hour week. Piece rate is $${rate} per unit, with a guaranteed minimum of the time rate ($${hr} per hour). Calculate the worker's pay ($).`,
      answer: Math.max(piece, time), tol: 0.5, explain: `Piece rate: ${units} × $${rate} = ${$(piece)}. Guaranteed: ${hrs} × $${hr} = ${$(time)}. Paid the higher: ${$(Math.max(piece, time))}.` };
  });
  GEN('a17', () => {
    const oh = rnd(40, 120) * 1000, lh = rnd(8, 30) * 1000;
    const oar = r2(oh / lh);
    return { type: 'num', q: `Budgeted production overheads are ${$(oh)} and budgeted direct labour hours are ${lh.toLocaleString()}. Calculate the overhead absorption rate per direct labour hour ($, 2 d.p.).`,
      answer: oar, tol: 0.01, explain: `OAR = budgeted overheads ÷ budgeted labour hours = ${oh} ÷ ${lh} = $${oar} per hour.` };
  });
  GEN('a17', () => {
    const oar = rnd(4, 12), hrs = rnd(8, 20) * 1000, act = oar * hrs + rnd(-8, 8) * 1000;
    const diff = oar * hrs - act;
    return { type: 'num', q: `The OAR is $${oar} per labour hour. Actual labour hours were ${hrs.toLocaleString()} and actual overheads were ${$(act)}. Calculate the over-absorption (+) or under-absorption (-) ($).`,
      answer: diff, tol: 0.5, explain: `Absorbed = ${oar} × ${hrs} = ${$(oar * hrs)}. Actual ${$(act)}. ${diff >= 0 ? 'Over' : 'Under'}-absorbed by ${$(Math.abs(diff))}.` };
  });
  GEN('a17', () => {
    const sp = rnd(20, 60), vc = rnd(8, sp - 6), fc = rnd(20, 80) * 1000, units = rnd(4, 12) * 1000;
    const profit = (sp - vc) * units - fc;
    return { type: 'num', q: `Selling price $${sp} per unit; variable cost $${vc} per unit; fixed costs ${$(fc)}. ${units.toLocaleString()} units are sold. Calculate profit using marginal costing ($).`,
      answer: profit, tol: 0.5, explain: `Contribution per unit = ${sp} - ${vc} = $${sp - vc}. Total contribution = ${$((sp - vc) * units)}. Profit = ${$((sp - vc) * units)} - ${$(fc)} = ${$(profit)}.` };
  });
  GEN('a17', () => {
    const fohu = rnd(2, 8), oi = rnd(1, 5) * 100, ci = rnd(1, 9) * 100;
    const diff = (ci - oi) * fohu;
    return { type: 'num', q: `Fixed production overhead is absorbed at $${fohu} per unit. Opening inventory is ${oi} units and closing inventory is ${ci} units. By how much does absorption costing profit exceed marginal costing profit ($; negative if lower)?`,
      answer: diff, tol: 0.5, explain: `Difference = change in inventory × fixed overhead per unit = (${ci} - ${oi}) × $${fohu} = ${$(diff)}.` };
  });

  // ---------- Paper 2 style explain / advise parts (self-marked) ----------
  P2('a8', 'Explain two reasons why a business should prepare a bank reconciliation statement. [4]',
    ['Identifies errors in the cash book or bank statement', 'Brings the cash book up to date (bank charges, direct debits, credit transfers)', 'Detects fraud / unauthorised payments', 'Identifies unpresented cheques or dishonoured cheques to follow up', 'Each reason developed with a consequence'],
    null);
  P2('a12', 'Two partners are considering admitting a third partner who will bring in $40 000 capital. Advise the partners whether they should admit the new partner. Justify your answer. [6]',
    ['Advantage: extra capital without borrowing / interest', 'Advantage: new skills, ideas, shared workload', 'Disadvantage: profits shared three ways; each existing partner\'s share falls', 'Disadvantage: loss of control, risk of disagreement', 'Mention goodwill adjustment / new profit-sharing ratio', 'Clear decision with justification'],
    null);
  P2('a13', 'The directors of a company need $500 000 to expand. Discuss whether they should issue ordinary shares or debentures. [8]',
    ['Shares: no fixed repayment or compulsory interest; dividends only if profitable', 'Shares: dilution of control and of earnings per share', 'Debentures: interest is compulsory and reduces profit; must be repaid', 'Debentures: no loss of control; interest may be cheaper than dividends', 'Effect on gearing / risk', 'Conclusion based on current profitability, control and risk'],
    null);
  P2('a7', 'Explain why inventory is valued at the lower of cost and net realisable value, referring to one accounting concept. [3]',
    ['Prudence: assets and profit should not be overstated', 'If NRV is below cost, the expected loss is recognised now', 'Link to IAS 2 / correct definition of NRV'],
    null);
  P2('a15', 'A business\'s current ratio has fallen from 2.1:1 to 1.2:1 and its liquid ratio from 1.1:1 to 0.5:1. Assess the liquidity of the business and suggest two ways to improve it. [8]',
    ['Both ratios fell: liquidity has worsened', 'Liquid ratio 0.5:1 below the usual benchmark of about 1:1: may struggle to pay current liabilities', 'Possible causes: higher payables, overdraft, cash spent on non-current assets', 'Improvement 1: better credit control / chase receivables', 'Improvement 2: sell excess inventory, long-term finance instead of overdraft, owner introduces capital', 'Balanced judgement'],
    null);
  P2('a17', 'Explain the difference between absorption costing and marginal costing and state one reason why a manager might prefer marginal costing. [5]',
    ['Absorption: all production costs (including fixed overheads) charged to units', 'Marginal: only variable costs charged to units; fixed costs are period costs', 'Inventory values differ, so profit differs when inventory levels change', 'Marginal costing is useful for decision-making (contribution) / avoids arbitrary apportionment'],
    null);
  P2('a1', 'A sole trader plans to convert the business into a private limited company. Explain two advantages and one disadvantage of doing so. [6]',
    ['Advantage: limited liability for the owners', 'Advantage: easier to raise capital by issuing shares', 'Advantage: separate legal entity / continuity', 'Disadvantage: formation costs and legal requirements (published accounts, audit)', 'Disadvantage: loss of some control / profits shared as dividends', 'Each point developed, not just listed'],
    null);
  P2('a2', 'Prepare journal entries (narratives not required) for: (i) equipment bought on credit from Tan Ltd for $6 000; (ii) the owner brings her own car worth $9 000 into the business; (iii) goods costing $300 taken by the owner for personal use. [6]',
    ['(i) Debit equipment $6 000', '(i) Credit Tan Ltd (other payable) $6 000', '(ii) Debit motor vehicle $9 000', '(ii) Credit capital $9 000', '(iii) Debit drawings $300', '(iii) Credit purchases $300'],
    null);
  GEN('a2', () => {
    const ob = rnd(20, 60) * 100, cp = rnd(80, 200) * 100, ro = rnd(2, 10) * 100, pay = rnd(70, 180) * 100, dr = rnd(1, 5) * 50;
    const cb = ob + cp - ro - pay - dr;
    return { type: 'num', q: `The account of a supplier, M Chen, in the purchases ledger: opening credit balance ${$(ob)}; credit purchases ${$(cp)}; returns outwards ${$(ro)}; payments ${$(pay)}; discount received ${$(dr)}. Calculate the closing balance owed to M Chen ($).`,
      answer: cb, tol: 0.5, explain: `Credits: ${ob} + ${cp} = ${ob + cp}. Debits: ${ro} + ${pay} + ${dr} = ${ro + pay + dr}. Balance owed = ${$(cb)}${cb < 0 ? ' (a debit balance: the supplier owes the business)' : ' (credit)'}.` };
  }, [2]);
  P2('a4', 'Explain the accruals concept and the prudence concept, giving an example of how each is applied when preparing financial statements. [4]',
    ['Accruals: income and expenses matched to the period in which they are earned/incurred, not when cash is received/paid', 'Accruals example: accrued or prepaid expenses adjusted at year end', 'Prudence: do not overstate assets/profit; do not understate liabilities/losses', 'Prudence example: allowance for doubtful debts / inventory at lower of cost and NRV'],
    null);
})();
