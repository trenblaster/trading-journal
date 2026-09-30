// Shared question-bank registry. Each subject file registers its topics and
// questions here. A question is one of:
//   mcq  - { options, answer (index), explain }
//   num  - { answer (number), tol, unit, explain }            typed numeric answer
//   self - { prompt, points[], model? }                        write, reveal, self-mark
// A generator is { gen: true, make() -> question } for fresh numbers every time.
(function () {
  const Bank = {
    subjects: {
      econ: { name: 'Economics', code: '9708', papers: {
        1: 'Paper 1 · Multiple choice. One mark each, AS content only.',
        2: 'Paper 2 · Data response and essays. Section A: compulsory data response. Section B: one essay from a choice, in two parts (a) 8 marks and (b) 12 marks.' } },
      acc: { name: 'Accounting', code: '9706', papers: {
        1: 'Paper 1 · Multiple choice across the AS content.',
        2: 'Paper 2 · Fundamentals of Accounting. Structured questions, mostly calculations and statements, with short explain/advise parts.' } },
      eng: { name: 'English Language', code: '9093', papers: {
        1: 'Paper 1 · Reading. Section A: Q1(a) directed response (150–200 words, 10 marks) and Q1(b) comparing your response with the original text (15 marks). Section B: Q2 text analysis of form, structure and language (25 marks).',
        2: 'Paper 2 · Writing. Section A: shorter writing plus a reflective commentary on your own choices. Section B: one extended writing task (600–900 words, 25 marks) from a choice of three.' } }
    },
    topics: { econ: [], acc: [], eng: [] },
    items: [],
    topic(subject, id, name, group, papers) { this.topics[subject].push({ id, name, group, papers: papers || [1, 2] }); },
    add(subject, q) {
      q.subject = subject;
      q.papers = q.papers || [1];
      q.id = q.id || subject + '-' + this.items.length;
      this.items.push(q);
      return q;
    },
    topicName(subject, id) {
      const t = this.topics[subject].find((t) => t.id === id);
      return t ? t.name : id;
    }
  };

  // Small helpers for generators.
  Bank.rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  Bank.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  Bank.money = (n) => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  Bank.r2 = (n) => Math.round(n * 100) / 100;

  window.Bank = Bank;
})();
