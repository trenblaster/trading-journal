// Accounting 9706 Paper 2 structured parts: calculations with fresh numbers and short explanations.
(function () {
  const S = 'acc';
  const GEN = (topic, make) => Bank.add(S, { gen: true, topic, make, papers: [2] });
  const SA = (topic, marks, q, points) => Bank.add(S, { type: 'self', topic, prompt: `${q} <span class="marks">[${marks}]</span>`, points, papers: [2] });
  const { rnd, pick, money: $, r2 } = Bank;

  SA('a1', 4, 'Explain two differences between a partnership and a limited company.', ['Liability: unlimited for partners vs limited for shareholders', 'Separate legal entity for a company', 'Sources of finance: shares vs partners\' capital', 'Legal requirements: company accounts published / audited']);
  SA('a1', 3, 'Explain why a bank might be reluctant to lend to a sole trader.', ['Limited assets / security', 'Risk depends on one person', 'Unlimited liability does not guarantee repayment']);
  SA('a2', 4, 'Explain the purpose of books of prime entry and name two of them.', ['Record transactions first before posting to the ledger', 'Reduce detail in the ledger / group similar transactions', 'Examples: sales journal, purchases journal, returns journals, cash book, journal']);
  SA('a3', 4, 'Explain two limitations of a trial balance.', ['Does not reveal errors that do not affect totals', 'Examples: omission, commission, principle, original entry, compensating, reversal', 'Agreement does not prove the accounts are correct']);
  GEN('a3', () => {
    const a = rnd(2, 9) * 100, b = rnd(1, 5) * 10;
    const diff = a - b;
    return { type: 'num', q: `A trial balance fails to agree. The errors are: (1) sales of ${$(a)} were not posted to the sales account; (2) discount allowed of ${$(b)} was not posted to the discount allowed account. What was the balance on the suspense account ($; credit balance as positive, debit as negative)?`,
      answer: diff, tol: 0.5, explain: `(1) A missing credit of ${a} means debits exceed credits: suspense needs a credit of ${a}. (2) A missing debit of ${b} means credits exceed debits: suspense needs a debit of ${b}. Net = ${a} - ${b} = ${$(diff)} ${diff >= 0 ? 'credit' : 'debit'}.` };
  });
  SA('a4', 4, 'Explain the going concern concept and how it affects the valuation of non-current assets.', ['Assumes the business will continue trading for the foreseeable future', 'Assets valued at cost less depreciation, not break-up value', 'If not a going concern, assets valued at what they would sell for']);
  SA('a5', 4, 'Explain the difference between capital and revenue expenditure, with an example of each.', ['Capital: acquiring or improving non-current assets, benefits several years', 'Revenue: day-to-day running costs, benefit this period', 'Example of each', 'Capital goes to the statement of financial position; revenue to the income statement']);
  SA('a6', 3, 'Explain why a business creates an allowance for doubtful debts.', ['Prudence: receivables should not be overstated', 'Some customers may not pay', 'Matches expected losses to the period of the sales']);
  GEN('a7', () => {
    const items = [0, 1, 2].map(() => { const cost = rnd(5, 30) * 100, nrv = cost + rnd(-10, 10) * 100; return { cost, nrv: Math.max(100, nrv) }; });
    const val = items.reduce((s, it) => s + Math.min(it.cost, it.nrv), 0);
    return { type: 'num', q: `Three inventory lines: A cost ${$(items[0].cost)}, NRV ${$(items[0].nrv)}; B cost ${$(items[1].cost)}, NRV ${$(items[1].nrv)}; C cost ${$(items[2].cost)}, NRV ${$(items[2].nrv)}. At what value should closing inventory be shown ($)?`,
      answer: val, tol: 0.5, explain: `Take the lower of cost and NRV for each line separately: ${items.map((it) => $(Math.min(it.cost, it.nrv))).join(' + ')} = ${$(val)}.` };
  });
  SA('a7', 3, 'Explain why inventory must be valued at the lower of cost and net realisable value.', ['Prudence: do not overstate assets or profit', 'If NRV is below cost, the loss is recognised now', 'IAS 2 requirement']);
  GEN('a9', () => {
    const ob = rnd(10, 40) * 1000, cp = rnd(50, 150) * 1000, pay = rnd(40, 140) * 1000, dr = rnd(5, 20) * 100, ro = rnd(5, 30) * 100, contra = rnd(2, 10) * 100;
    const cb = ob + cp - pay - dr - ro - contra;
    return { type: 'num', q: `Purchases ledger control: opening credit balance ${$(ob)}; credit purchases ${$(cp)}; payments to suppliers ${$(pay)}; discounts received ${$(dr)}; returns outwards ${$(ro)}; contra with sales ledger ${$(contra)}. Calculate the closing credit balance ($).`,
      answer: cb, tol: 0.5, explain: `Credits ${ob} + ${cp} = ${ob + cp}. Debits ${pay} + ${dr} + ${ro} + ${contra} = ${pay + dr + ro + contra}. Balance = ${$(cb)}.` };
  });
  SA('a9', 4, 'Explain two uses of control accounts.', ['Check arithmetical accuracy of the personal ledgers', 'Help locate errors to a particular ledger', 'Quick totals of receivables and payables for financial statements', 'Deter fraud (different staff keep ledgers and control accounts)']);
  GEN('a11', () => {
    const rev = rnd(100, 300) * 1000, cos = Math.round(rev * rnd(45, 70) / 100 / 1000) * 1000, dr = rnd(1, 5) * 500, exp = rnd(15, 60) * 1000, dep = rnd(2, 10) * 1000;
    const p = rev - cos + dr - exp - dep;
    return { type: 'num', q: `Revenue ${$(rev)}; cost of sales ${$(cos)}; discount received ${$(dr)}; operating expenses ${$(exp)}; depreciation ${$(dep)}. Calculate profit for the year ($).`,
      answer: p, tol: 0.5, explain: `Gross profit = ${rev} - ${cos} = ${$(rev - cos)}. + discount received ${dr} - expenses ${exp} - depreciation ${dep} = ${$(p)}.` };
  });
  SA('a12', 4, 'Explain why partners might agree to pay interest on capital and salaries.', ['Rewards partners who invest more capital', 'Rewards partners who work more / have more responsibility', 'Fairer than equal sharing', 'Reduces disputes']);
  SA('a13', 4, 'Explain the difference between a bonus issue and a rights issue.', ['Bonus: free shares from reserves; no cash raised', 'Rights: shares sold to existing shareholders, usually at a discount; raises cash', 'Both in proportion to existing holdings', 'Effect on reserves / share capital']);
  SA('a14', 3, 'Explain why a trader might not keep a full set of double-entry records, and one problem this causes.', ['Cost / time / lack of expertise', 'Problem: profit cannot be calculated accurately; errors or fraud harder to detect', 'Needs statement of affairs / reconstruction']);
  SA('a15', 4, 'Explain two limitations of using ratios to compare two businesses.', ['Different accounting policies (depreciation, inventory valuation)', 'Different sizes / industries / year ends', 'Historical figures; may not predict the future', 'Ignore non-financial factors']);
  SA('a16', 4, 'Explain one advantage and one disadvantage of paying workers by piece rate.', ['Advantage: incentive to increase output', 'Advantage explained (lower cost per unit / reward for effort)', 'Disadvantage: quality may fall / rushing / safety', 'Disadvantage explained (more inspection needed)']);
  SA('a17', 4, 'Explain the difference between allocation, apportionment and absorption of overheads.', ['Allocation: whole cost charged to one cost centre', 'Apportionment: shared between cost centres on a fair basis', 'Absorption: overheads charged to units using an OAR', 'Example of a basis']);
})();
