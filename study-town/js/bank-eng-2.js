// Extra English Language 9093 questions: more text types, extracts and tasks in the style of Papers 1 and 2.
(function () {
  const S = 'eng';
  const M = (topic, q, options, answer, explain, papers) => Bank.add(S, { type: 'mcq', topic, q, options, answer, explain, papers: papers || [1, 2] });
  const SELF = (topic, prompt, points, papers) => Bank.add(S, { type: 'self', topic, prompt, points, papers });
  const X = (title, body) => `<figure class="extract"><figcaption>${title}</figcaption>${body}</figure>`;

  // ---------- Extracts across the syllabus text types ----------
  const editorial = X('Extract E · Newspaper editorial', `<p><b>Our libraries are not a luxury</b></p><p>The council's plan to close four branch libraries is short-sighted. We understand that budgets are tight. But a library is not simply a room full of books: it is a warm place for the lonely, a free classroom for the curious and, for many families, the only place with reliable internet. Close them, and we close doors that will not easily reopen. We urge councillors to think again.</p>`);
  M('e5', editorial + 'Which feature shows that this is an editorial rather than a news report?',
    ['It presents the newspaper\'s collective opinion using "We" and urges action', 'It has a headline', 'It mentions the council', 'It uses paragraphs'], 0,
    'Editorials argue the publication\'s stance. Note the first-person plural and the direct call to councillors.');
  M('e5', editorial + 'What is the effect of the concession "We understand that budgets are tight"?',
    ['It acknowledges the counter-argument so the writer appears reasonable before rebutting it', 'It agrees that the libraries should close', 'It adds statistical evidence', 'It changes the topic'], 0,
    'Concession followed by "But" is a classic persuasive structure that builds credibility.');
  M('e5', editorial + '"a warm place for the lonely, a free classroom for the curious and... the only place with reliable internet" is an example of',
    ['a tricolon that widens the idea of what a library is', 'a rhetorical question', 'an oxymoron', 'onomatopoeia'], 0,
    'The list of three redefines libraries through emotional and practical benefits.');
  M('e5', editorial + 'How does the metaphor "we close doors that will not easily reopen" work?',
    ['Literal library doors stand for lost opportunities, making the closure seem permanent', 'It describes the building\'s architecture', 'It is a statistic', 'It is a simile about weather'], 0,
    'The image links the physical closure to lasting social harm.');

  const review = X('Extract F · Film review', `<p><b>Tidewater ★★★★☆</b></p><p>Director Amara Osei's second feature is a slow burn that rewards patience. Set in a fishing village facing its final season, the film lets silence do the talking: long, grey shots of empty nets say more than any speech could. Only a rushed final act, which ties up every loose end a little too neatly, keeps it from greatness. Go for the cinematography; stay for Kwame Mensah's quietly devastating lead performance.</p>`);
  M('e5', review + 'Which conventions of a review are shown?',
    ['Star rating, identifying the creator, evaluative language and a recommendation', 'Dated entry and private reflection', 'Lead paragraph with who, what, where, when', 'Speaker labels'], 0,
    'Reviews evaluate with justification and guide the reader\'s choice.');
  M('e5', review + 'Why does the reviewer mention a weakness ("a rushed final act")?',
    ['To seem balanced and credible, which strengthens the overall praise', 'To tell readers not to watch it', 'Because reviews must be negative', 'To summarise the plot'], 0,
    'Balanced evaluation (four stars, not five) makes the recommendation more trustworthy.');
  M('e5', review + '"Go for the cinematography; stay for... performance" uses',
    ['parallel imperative clauses to end with a memorable recommendation', 'passive voice', 'a rhetorical question', 'reported speech'], 0,
    'The balanced structure gives a punchy, quotable conclusion typical of reviews.');

  const diary = X('Extract G · Diary', `<p><b>Thursday 12th</b></p><p>Results tomorrow. Can't eat. Mum made my favourite and I just pushed it round the plate like a toddler. Kept checking the website even though I know it doesn't open till eight. Stupid. Whatever happens, happens. (It won't be fine. It'll be fine.)</p>`);
  M('e5', diary + 'Which features show this is a private diary?',
    ['Date heading, first person, minor sentences and candid, self-directed comments', 'Headline and standfirst', 'Formal register and a sign-off', 'Bullet points and contact details'], 0,
    'The writer addresses only themself, so grammar is informal and elliptical ("Can\'t eat.").');
  M('e5', diary + 'What is the effect of the elliptical sentences such as "Can\'t eat." and "Stupid."?',
    ['They mimic anxious, fragmented thought', 'They show formal control', 'They make the text persuasive', 'They give instructions'], 0,
    'Omitting the subject creates a breathless, private voice.');
  M('e5', diary + 'How does the final bracketed sentence create meaning?',
    ['The contradiction "It won\'t be fine. It\'ll be fine." shows the writer\'s inner conflict', 'It is a quotation from a teacher', 'It summarises the plot', 'It is a stage direction'], 0,
    'Juxtaposed statements reveal the writer arguing with themself, adding humour and anxiety.');

  const speech = X('Extract H · Speech at a school assembly', `<p>Good morning, everyone. Look around you. The person next to you might be a future doctor. A future engineer. A future Prime Minister. But none of that happens by accident. It happens because, one ordinary Tuesday, someone decided to try. So I'm asking you — just for this term — to be that someone.</p>`);
  M('e5', speech + 'Which features show the text is written to be spoken?',
    ['Greeting, direct address, imperatives and repetition', 'Footnotes', 'A headline and byline', 'A star rating'], 0,
    'Speeches use features that help listeners follow and remember: "Look around you", "A future..." repeated, a clear call to action.');
  M('e5', speech + 'What is the effect of the repetition of "A future..."?',
    ['It builds a rising list of possibilities that inspires the audience', 'It shows the speaker is unsure', 'It introduces a counter-argument', 'It creates a formal register'], 0,
    'Anaphora with minor sentences creates rhythm and a sense of growing ambition.');
  M('e5', speech + 'Why does the speaker say "one ordinary Tuesday"?',
    ['To suggest that success starts with small, everyday decisions any listener can make', 'To give the date of the assembly', 'Because it is a formal convention', 'To show the speaker dislikes Tuesdays'], 0,
    'The specific, mundane detail makes the message feel achievable.');

  const auto = X('Extract I · Autobiography', `<p>I was nine when my grandmother taught me to bargain. The market in Kumasi was a wall of noise and colour, and she moved through it like a ship through waves, pausing only to lift a yam, frown at it theatrically, and name a price so low the seller laughed out loud. I did not understand then that she was teaching me more than arithmetic.</p>`);
  M('e5', auto + 'Which feature is typical of autobiography?',
    ['A retrospective first-person narrator reflecting on a formative memory', 'An impersonal third-person report', 'A call to action', 'Numbered instructions'], 0,
    'The adult narrator looks back ("I did not understand then") and reflects on meaning.');
  M('e5', auto + '"she moved through it like a ship through waves" is',
    ['a simile presenting the grandmother as calm and powerful', 'a metaphor about the sea', 'personification of the market', 'hyperbole'], 0,
    'The comparison contrasts her steady progress with the chaotic "wall of noise and colour".');
  M('e5', auto + 'What is the structural function of the final sentence?',
    ['It shifts from the child\'s view to adult reflection, hinting at a deeper lesson', 'It introduces a new character', 'It summarises the market prices', 'It ends the story with a cliffhanger'], 0,
    'Autobiographies often move from anecdote to reflection.');

  const brochure = X('Extract J · College brochure', `<p><b>Why choose Hillview College?</b></p><p><b>Small classes.</b> Never more than 16 students, so every voice is heard.</p><p><b>Real-world learning.</b> Placements with over 200 local employers.</p><p><b>Your future, your way.</b> Over 40 courses, from engineering to fashion design.</p><p>Book your open-day place today at hillview.example.</p>`);
  M('e5', brochure + 'How is the brochure structured to persuade?',
    ['Bold subheadings each followed by a short benefit, ending with a call to action', 'A chronological narrative', 'A balanced argument with a conclusion', 'A dated diary format'], 0,
    'Short, scannable sections make benefits easy to take in; the final imperative prompts action.');
  M('e5', brochure + 'What is the effect of the numbers ("16", "over 200", "over 40")?',
    ['Specific figures give factual credibility to the claims', 'They make the text informal', 'They show the writer is uncertain', 'They are rhetorical questions'], 0,
    'Statistics act as evidence (logos) in persuasive texts.');
  M('e5', brochure + '"Your future, your way." uses',
    ['repetition of the second-person possessive to personalise the appeal', 'a passive construction', 'an oxymoron', 'a counter-argument'], 0,
    'Synthetic personalisation makes the reader feel individually addressed.');

  const letter = X('Extract K · Formal letter', `<p>Dear Ms Rahman,</p><p>I am writing to express my concern about the lack of safe crossings on Station Road. On 3 March, my son narrowly avoided being hit by a car while walking to school. I would be grateful if the council could consider installing a pedestrian crossing near the school gates.</p><p>Yours sincerely,<br>David Chen</p>`);
  M('e1', letter + 'Why does the letter end "Yours sincerely"?',
    ['Because the recipient is addressed by name', 'Because the letter is informal', 'Because the recipient is unknown', 'It is always used in complaints'], 0,
    'A named recipient takes "Yours sincerely"; "Dear Sir or Madam" takes "Yours faithfully".');
  M('e1', letter + 'Which features are typical of a formal letter of complaint?',
    ['Purpose stated early, specific evidence, polite request and formal register', 'Slang and emojis', 'A headline and byline', 'A narrative with dialogue'], 0,
    '"I am writing to express..." states purpose; the date and incident are evidence; "I would be grateful if..." is a polite request.');

  const narrative = X('Extract L · Narrative opening', `<p>The lights went out at 9.14. Nadia knew because she was staring at the clock, willing the minutes to move, when the whole building sighed and went black. Somewhere below, a door slammed. Then another. Then nothing at all.</p>`);
  M('e8', narrative + 'How does the writer create tension?',
    ['A precise time, sudden darkness, and short sentences that slow the pace', 'A long description of the weather', 'A balanced argument', 'Formal register'], 0,
    'The build-up "a door slammed. Then another. Then nothing at all." uses minor sentences and silence to create suspense.');
  M('e8', narrative + '"the whole building sighed" is an example of',
    ['personification', 'simile', 'alliteration', 'hyperbole'], 0,
    'Giving the building a human action makes the setting feel alive and uneasy.');

  const descriptive = X('Extract M · Descriptive writing', `<p>The harbour at dawn is a watercolour left out in the rain. Masts lean together, whispering. A gull stitches the grey sky to the grey sea, and on the quay a single orange buoy glows like a coal in a cold grate.</p>`);
  M('e8', descriptive + 'Which feature is most typical of descriptive writing here?',
    ['Imagery and sensory detail creating atmosphere, with little action or plot', 'Dialogue driving a plot', 'A clear argument', 'Headings and bullet points'], 0,
    'The piece paints a scene through metaphor, personification and colour contrast.');
  M('e8', descriptive + 'What is the effect of the colour contrast between "grey" and "orange buoy"?',
    ['It creates a focal point that draws the eye in a muted scene', 'It shows it is night', 'It explains the plot', 'It is a statistic'], 0,
    'The single warm colour, compared to "a coal in a cold grate", stands out against the cold palette.');

  const invest = X('Extract N · Investigative journalism', `<p>Documents seen by this newspaper show that the company knew its water filters failed safety tests in 2022. Internal emails, dated eleven months before the product launch, describe the results as "catastrophic". Three former employees, speaking on condition of anonymity, confirmed that managers were told. The company declined to comment.</p>`);
  M('e5', invest + 'Which conventions of investigative journalism are shown?',
    ['Evidence from documents, dated sources, anonymous witnesses and a right of reply', 'Star rating and verdict', 'First-person diary entries', 'A slogan'], 0,
    'Investigative pieces build a case from verified evidence and usually record whether the subject responded.');
  M('e5', invest + 'Why is the short final sentence "The company declined to comment." effective?',
    ['Its flat, factual tone lets readers draw their own conclusions', 'It shows the journalist agrees with the company', 'It is a rhetorical question', 'It adds humour'], 0,
    'Ending with the refusal implies the company has no defence, without the writer stating an opinion.');

  const blog = X('Extract O · Travel blog', `<p><b>48 hours in Penang (on a student budget!)</b></p><p>Okay, confession time: I ate breakfast three times on day one. Can you blame me? Char kway teow for under $2?! Here are my top tips so you don't waste a single ringgit…</p>`);
  M('e1', blog + 'Which features mark this as a blog rather than travel writing in a book?',
    ['A catchy title, chatty direct address to readers, exclamations and practical tips', 'Formal register and footnotes', 'Chapter numbers', 'An impersonal third-person voice'], 0,
    'Blogs build a relationship with an online audience: "Can you blame me?", "so you don\'t waste...".');
  M('e1', blog + 'What is the effect of "Okay, confession time:"?',
    ['An informal discourse marker creates intimacy, as if talking to a friend', 'It introduces a formal argument', 'It signals a list of statistics', 'It is a legal disclaimer'], 0,
    'Spoken-style openers are common in blogs to establish a personal voice.');

  // ---------- More terminology ----------
  M('e2', '"The silence was deafening." This is an example of',
    ['an oxymoron', 'onomatopoeia', 'a simile', 'alliteration'], 0,
    'Two contradictory ideas are combined for effect.');
  M('e2', 'What is a declarative sentence?',
    ['A statement', 'A command', 'A question', 'An exclamation'], 0,
    'The four sentence functions: declarative (statement), imperative (command), interrogative (question), exclamative (exclamation).');
  M('e2', 'A writer uses "we" and "us" to include the reader. This is called',
    ['inclusive pronouns', 'passive voice', 'third-person narration', 'ellipsis'], 0,
    'Inclusive pronouns build a sense of shared identity with the audience.');
  M('e2', 'Using a word that sounds like its meaning (e.g. "crash", "sizzle") is',
    ['onomatopoeia', 'assonance', 'alliteration', 'euphemism'], 0,
    'Onomatopoeia appeals to the sense of hearing.');
  M('e2', '"passed away" instead of "died" is an example of',
    ['euphemism', 'hyperbole', 'jargon', 'irony'], 0,
    'A euphemism softens something unpleasant.');
  M('e2', 'Which is the best definition of "lexis"?',
    ['The vocabulary (word choice) of a text', 'The sentence structure', 'The layout of a text', 'The sound of a text'], 0,
    'Language analysis often considers lexis, grammar, phonology, semantics and discourse.');
  M('e2', 'A complex sentence contains',
    ['a main clause and at least one subordinate clause', 'two main clauses joined by "and"', 'only one clause', 'no verb'], 0,
    'E.g. "Although it was raining, we walked home." The subordinate clause depends on the main clause.');
  M('e2', 'The passive voice ("Mistakes were made") can be used to',
    ['hide or downplay who is responsible', 'make the subject more active', 'create a question', 'give a command'], 0,
    'Removing the agent shifts attention away from who did the action.');
  M('e2', 'Which is an example of a rhetorical question?',
    ['"Who wouldn\'t want cleaner air?"', '"What time does the train leave?"', '"Pass the salt."', '"The train leaves at six."'], 0,
    'A rhetorical question is asked for effect, with an obvious or implied answer.');
  M('e2', 'Sibilance is',
    ['the repetition of "s" sounds', 'repetition of vowel sounds', 'a type of metaphor', 'a pause in speech'], 0,
    'E.g. "the sea hissed softly on the sand"; it can create a soothing or sinister effect.');
  M('e2', 'What is a cyclical structure?',
    ['A text that ends by returning to an image or idea from its opening', 'A text in chronological order', 'A text with bullet points', 'A text with no paragraphs'], 0,
    'Returning to the start can create closure or show how something has (or has not) changed.');
  M('e2', 'Using a formal, technical vocabulary specific to a subject (e.g. "fiscal stimulus") is called',
    ['jargon', 'slang', 'dialect', 'colloquialism'], 0,
    'Jargon suits expert audiences but can exclude general readers.');

  // ---------- Directed response / comparison / analysis tasks ----------
  M('e3', 'A Q1(a) task asks you to turn a formal report into a leaflet for teenagers. Which change is most important?',
    ['Adapting register, layout and content to teenagers while keeping key facts from the report', 'Keeping the formal register of the report', 'Adding a star rating', 'Writing 600 words'], 0,
    'The new form, audience and purpose drive every choice.');
  M('e3', 'Which is the best opening for a directed response written as a diary entry from a travel article?',
    ['"Day 3. My feet hate me, but that view from the ridge? Worth every blister."', '"This article will describe a mountain walk."', '"Mountains are high places."', '"Dear Sir or Madam,"'], 0,
    'It uses diary conventions: date, first person, informal and candid voice.');
  M('e4', 'In Q1(b), which sentence best compares structure?',
    ['"The original moves chronologically through the journey, whereas my leaflet is organised by headings so readers can quickly find practical advice."', '"Both texts are good."', '"The original text uses words."', '"My text is 180 words."'], 0,
    'It identifies a structural difference in both texts and explains it through purpose and audience.');
  M('e4', 'What should you avoid in Q1(b)?',
    ['Only describing your own text without comparing it to the original', 'Using quotations from both texts', 'Linking choices to audience', 'Using terminology'], 0,
    'The question requires comparison of the two texts\' styles.');
  M('e5', 'Which is the most analytical sentence for a Q2 response?',
    ['"The imperative \'Imagine\' pulls the reader into the scene, making the charity\'s appeal feel personal and urgent."', '"The writer uses lots of good words."', '"There is an imperative."', '"I liked this text."'], 0,
    'It names the feature, quotes it and explains its effect in context.');

  SELF('e3', `<b>Q1(a) style task.</b> Read Extract E (editorial):<br>${editorial}<br>A local teenager writes a <b>speech</b> for a council meeting arguing to keep their branch library open. Write the speech (150–200 words), using ideas from the editorial.`,
    ['Speech conventions: address to councillors, signposting, direct address, memorable ending', 'Teen voice and perspective adapted from the editorial', 'Uses ideas from the source (community space, internet access, lonely people) without copying', 'Persuasive devices used purposefully', 'Within 150–200 words', 'Accurate, controlled expression'], [1]);
  SELF('e4', `<b>Q1(b) style task.</b> Compare the style of your speech with Extract E. Refer to form, structure and language.`,
    ['Compares form: written editorial vs spoken speech', 'Compares structure: concession-then-rebuttal vs signposted spoken sections', 'Compares language: "We" (newspaper) vs "I"/"you" (personal voice); rhetorical devices in both', 'Quotes from BOTH texts', 'Explains differences through audience, purpose and context'], [1]);
  SELF('e5', `<b>Q2 style task.</b> Analyse Extract I (autobiography):<br>${auto}<br>Analyse how the writer uses form, structure and language to present the memory.`,
    ['Form: retrospective first-person autobiography; adult looking back', 'Structure: moves from anecdote to reflection in the final sentence', 'Language: simile of the ship, "wall of noise and colour", "theatrically"', 'Characterisation of the grandmother through actions', 'Terminology plus quotation plus effect throughout', 'Considers audience and purpose (entertain, reflect, inform about culture)'], [1]);
  SELF('e5', `<b>Q2 style task.</b> Analyse Extract N (investigative journalism):<br>${invest}<br>How does the writer use language and structure to build a case against the company?`,
    ['Evidence-led structure: documents, dates, witnesses, then the company\'s silence', 'Precise detail ("eleven months before", "2022") builds credibility', 'Quotation "catastrophic" as powerful evidence', 'Neutral, factual register lets evidence speak', 'Final short sentence implies guilt', 'Clear use of terminology and effect'], [1]);
  SELF('e3', `<b>Q1(a) style task.</b> Read Extract F (film review):<br>${review}<br>Kwame Mensah, the lead actor, writes a <b>blog post</b> for fans about filming in the village. Write the opening (150–200 words), using details from the review.`,
    ['Blog conventions: title, first person, chatty direct address to fans', 'Adapts details from the review (village, final season, empty nets, silence)', 'Actor\'s perspective and personal anecdote', 'Suitable register for fans', 'Within 150–200 words'], [1]);

  // ---------- Paper 2 writing ----------
  M('e6', 'You are asked to write a formal letter to a newspaper. What should the opening do?',
    ['State clearly why you are writing', 'Tell a long story first', 'Use slang to sound friendly', 'Start with a rhetorical question every time'], 0,
    'Formal letters make their purpose clear early.');
  M('e7', 'In a reflective commentary, which is the best way to discuss your choice of a short sentence?',
    ['Quote it and explain the effect you intended on your reader', 'Say that short sentences are good', 'Count how many short sentences you used', 'Apologise for not using longer sentences'], 0,
    'Reflect on why you made the choice, linked to the task.');
  M('e7', 'A reflective commentary should NOT',
    ['retell the content of your writing', 'refer to audience and purpose', 'quote your own choices', 'use terminology'], 0,
    'Summarising what happens earns little credit; analyse your choices instead.');
  M('e9', 'Which structure suits a discursive article?',
    ['Introduction, balanced sections on different views, then a considered conclusion', 'A story with a twist', 'Bullet points only', 'A single paragraph'], 0,
    'Discursive writing weighs views before reaching a judgement.');
  M('e9', 'Which sentence best introduces a counter-argument in an argumentative speech?',
    ['"Some will say that a car-free centre will hurt shops. Yet cities that tried it saw footfall rise."', '"Cars are bad."', '"I will now stop."', '"Everyone agrees with me."'], 0,
    'It acknowledges the opposing view and immediately rebuts it with evidence.');
  M('e10', 'Which sentence is punctuated correctly?',
    ['"However, the plan was never approved."', '"However the plan, was never approved."', '"However; the plan was never approved."', '"However the plan was never, approved."'], 0,
    'A sentence adverb like "However" at the start is followed by a comma.');
  M('e10', 'Which is the correct use of an apostrophe?',
    ['"The students\' results were published."', '"The student\'s were happy."', '"Its\' raining."', '"The book\'s are on the table."'], 0,
    'Plural possessive ending in -s takes the apostrophe after the s. Plurals and "its" (possessive) do not take apostrophes.');
  M('e10', 'Which word is spelled correctly?',
    ['necessary', 'neccessary', 'necesary', 'neccesary'], 0,
    'One c, double s.');

  SELF('e6', `<b>Section A style task.</b> Write a <b>review</b> of a place you know well (a café, park or museum) for a student website. Then write a reflective commentary on your choices.`,
    ['Review conventions: identifies the place, evaluates with reasons, gives a verdict or rating', 'Register suited to a student website audience', 'Specific, vivid detail rather than general praise', 'Balanced evaluation', 'Commentary quotes your review and explains intended effects', 'Commentary links choices to audience and purpose'], [2]);
  SELF('e6', `<b>Section A style task.</b> Write a <b>diary entry</b> by someone the night before moving to a new country. Then write a reflective commentary on your choices.`,
    ['Diary conventions: date, first person, private voice, candid emotions', 'Informal features used deliberately (minor sentences, ellipsis)', 'Clear sense of situation and conflicting feelings', 'Controlled structure (e.g. moving from events to reflection)', 'Commentary quotes your own language and explains its effect', 'Commentary links choices to form and purpose'], [2]);
  SELF('e8', `<b>Section B style task (imaginative).</b> Write a story that begins: "Nobody noticed when the lighthouse went dark." (600–900 words)`,
    ['Uses the given opening effectively and builds from it', 'Developed characters and a clear narrative voice', 'Shaped structure with tension and a satisfying resolution', 'Varied sentences and paragraphing for pace', 'Precise, controlled imagery', 'Accurate expression'], [2]);
  SELF('e8', `<b>Section B style task (descriptive).</b> Describe a busy railway station at two different times of day. (600–900 words)`,
    ['Clear contrast between the two times (structure)', 'Rich sensory detail and precise vocabulary', 'Figurative language used with control', 'Focus on atmosphere rather than plot', 'Varied sentence structures', 'Accurate expression'], [2]);
  SELF('e9', `<b>Section B style task (argumentative).</b> Write a letter to your head teacher arguing that homework should be abolished. (600–900 words)`,
    ['Letter conventions and formal register', 'Clear position sustained throughout', 'Evidence, examples and persuasive techniques', 'Counter-arguments rebutted', 'Logical, well-linked paragraphs', 'Accurate expression'], [2]);
  SELF('e9', `<b>Section B style task (discursive).</b> Write an essay discussing whether tourism does more good than harm to local communities. (600–900 words)`,
    ['Clear introduction framing the issue', 'Balanced consideration of economic, social and environmental views', 'Examples to support each point', 'Discourse markers guide the reader', 'Considered, justified conclusion', 'Accurate expression'], [2]);
})();
