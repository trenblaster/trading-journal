// Cambridge International AS Level English Language 9093 (AS: Paper 1 Reading, Paper 2 Writing).
// Text types follow the syllabus list: advertisements, brochures, leaflets, editorials, news stories,
// articles, reviews, blogs, investigative journalism, letters, podcasts, (auto)biographies, travel
// writing, diaries, essays, scripted speech, narrative writing and descriptive writing.
(function () {
  const S = 'eng';
  const T = (id, name, group, papers) => Bank.topic(S, id, name, group, papers);
  const M = (topic, q, options, answer, explain, papers) => Bank.add(S, { type: 'mcq', topic, q, options, answer, explain, papers: papers || [1, 2] });
  const SELF = (topic, prompt, points, model, papers) => Bank.add(S, { type: 'self', topic, prompt, points, model, papers });
  const X = (title, body) => `<figure class="extract"><figcaption>${title}</figcaption>${body}</figure>`;

  const gA = 'Paper 1 · Reading';
  T('e1', 'Text types and their conventions', gA, [1, 2]);
  T('e2', 'Language and rhetorical techniques', gA, [1, 2]);
  T('e3', 'Q1(a) Directed response', gA, [1]);
  T('e4', 'Q1(b) Comparing your response with the original', gA, [1]);
  T('e5', 'Q2 Text analysis: form, structure, language', gA, [1]);
  const gB = 'Paper 2 · Writing';
  T('e6', 'Section A: Shorter writing', gB, [2]);
  T('e7', 'Section A: Reflective commentary', gB, [2]);
  T('e8', 'Section B: Imaginative and descriptive writing', gB, [2]);
  T('e9', 'Section B: Discursive and argumentative writing', gB, [2]);
  T('e10', 'Register, structure and accuracy', gB, [2]);

  // ---------- Conventions of the syllabus text types ----------
  M('e1', 'Which feature is a convention of a <b>news story</b>?',
    ['An opening paragraph that answers who, what, where and when', 'A dated, private entry written for the writer alone', 'A star rating and a final recommendation', 'A slogan and a call to action'], 0,
    'News stories usually use a headline, a lead (opening) paragraph with the key facts, an inverted-pyramid structure (most important first), attributed quotations and a largely impersonal third-person voice.');
  M('e1', 'The inverted pyramid structure, typical of news stories, means',
    ['the most important information comes first and detail follows', 'the story builds to a climax at the end', 'events are always told in chronological order', 'the writer\'s opinion comes first'], 0,
    'Readers (and editors cutting from the bottom) get the key facts first.');
  M('e1', 'Which convention best distinguishes an <b>editorial</b> from a news story?',
    ['It argues the publication\'s own view on a current issue', 'It includes quotations from witnesses', 'It is written in the third person', 'It has a headline'], 0,
    'An editorial is an opinion piece representing the newspaper or magazine\'s stance, often unsigned and often using the first-person plural ("we believe...").');
  M('e1', 'Which set of features is most typical of a <b>diary</b> entry?',
    ['Dated entries, first person, candid feelings, an audience of the writer', 'Headline, byline, standfirst, subheadings', 'Greeting, formal sign-off, sender\'s address', 'Speaker labels, intro and outro, sponsor message'], 0,
    'Diaries are private and reflective, often informal, sometimes with elliptical sentences ("Couldn\'t sleep again.").');
  M('e1', 'A <b>blog</b> post differs from a diary mainly because it',
    ['is written for a public online audience and invites responses', 'is written in the first person', 'describes personal experiences', 'can be informal'], 0,
    'Both can be personal and first-person. Blogs are public: titles, direct address to readers, links, comments, regular posts.');
  M('e1', 'Which is a convention of a <b>review</b>?',
    ['Evaluative language that judges quality, leading to a recommendation', 'A neutral account with no opinion', 'Numbered instructions', 'A formal sign-off such as "Yours faithfully"'], 0,
    'Reviews identify the subject (title, creator, venue), give enough context without spoilers, evaluate with justification and often end with a verdict or rating.');
  M('e1', 'Which features are most typical of an <b>advertisement</b>?',
    ['Brand name, slogan, imperative verbs and a call to action', 'Chronological account of a life', 'Unsigned editorial opinion', 'Scene-setting and dialogue'], 0,
    'Advertisements aim to persuade a target audience, using direct address, positive or emotive lexis, and often layout and images.');
  M('e1', 'Which is the most typical purpose of a <b>brochure</b> (e.g. for a hotel or college)?',
    ['To inform and persuade, with sections organised under headings', 'To record private thoughts', 'To report breaking news neutrally', 'To entertain through a fictional plot'], 0,
    'Brochures combine information with persuasion: headings and subheadings, positive descriptive language, images, contact or booking details.');
  M('e1', 'A health <b>leaflet</b> is most likely to use',
    ['short sections, headings, bullet points and clear advice or contact details', 'long reflective paragraphs', 'a narrative with a twist ending', 'formal letter conventions'], 0,
    'Leaflets are concise and easy to scan; they often address the reader directly and give practical information or a call to action.');
  M('e1', 'Which is a key convention of <b>investigative journalism</b>?',
    ['Detailed evidence from research, documents and sources that exposes an issue', 'A light-hearted personal anecdote only', 'A star rating', 'An imagined setting'], 0,
    'Investigative pieces are in-depth: data, named or anonymous sources, interviews, and a serious tone that holds individuals or organisations to account.');
  M('e1', 'In a <b>formal letter</b> that begins "Dear Sir or Madam", the conventional sign-off is',
    ['Yours faithfully', 'Yours sincerely', 'Best wishes', 'Cheers'], 0,
    'In British conventions, "Dear Sir or Madam" pairs with "Yours faithfully"; a named recipient ("Dear Ms Rao") pairs with "Yours sincerely".');
  M('e1', 'Which feature would you expect in a <b>podcast</b> transcript but not in a printed article?',
    ['Fillers, false starts and turn-taking between speakers', 'A headline', 'Paragraphs', 'Quotations'], 0,
    'Transcripts of spontaneous or semi-scripted speech show non-fluency features (um, er, repairs), discourse markers ("so", "right"), overlaps, and direct address to listeners.');
  M('e1', 'How does <b>autobiography</b> differ from <b>biography</b>?',
    ['Autobiography is written by the subject, usually in the first person', 'Autobiography is always fictional', 'Biography is always in the present tense', 'There is no difference'], 0,
    'Both are usually retrospective and selective about significant events. Autobiography offers reflection from the subject\'s own perspective.');
  M('e1', 'Which set of features is most typical of <b>travel writing</b>?',
    ['First-person experience, sense of place through sensory detail, reflection', 'Numbered instructions and warnings', 'Balanced arguments with a thesis', 'Speaker labels and timestamps'], 0,
    'Travel writing informs and entertains: vivid description of places, people and culture, anecdotes, and the writer\'s personal response.');
  M('e1', 'A <b>scripted speech</b> is written to be heard. Which features show this?',
    ['Direct address, repetition, signposting and rhetorical questions', 'Footnotes and a bibliography', 'Subheadings and bullet points', 'A dated entry'], 0,
    'Speeches help listeners follow and remember: greetings, inclusive pronouns ("we"), patterns of three, anaphora, clear structure and a memorable ending.');
  M('e1', 'Which is a convention of a discursive <b>essay</b>?',
    ['A clear line of reasoning with topic sentences and a conclusion', 'A slogan', 'Private, dated entries', 'Scene description with no argument'], 0,
    'Essays develop ideas logically in paragraphs, use evidence and examples, maintain an appropriate (usually formal) register and conclude.');
  M('e1', 'Which is most important in <b>descriptive writing</b>?',
    ['Creating atmosphere and a vivid sense of place through sensory detail and imagery', 'A complex plot with a twist', 'Balanced arguments for and against', 'A call to action'], 0,
    'Descriptive writing focuses on detail and atmosphere rather than events; structure often moves across space or time (e.g. zooming in and out).');
  M('e1', 'Which is most important in <b>narrative writing</b>?',
    ['A developed plot, characterisation and a controlled narrative voice', 'A list of facts under subheadings', 'An argued thesis', 'A rating out of five'], 0,
    'Narratives use a clear perspective (first or third person), setting, dialogue, pacing and a shaped structure (e.g. opening, complication, resolution).');
  M('e1', 'A newspaper <b>article</b> (a feature) is more likely than a news story to include',
    ['the writer\'s personal voice and opinion alongside facts', 'only the key facts in the first line', 'no headline', 'speaker labels'], 0,
    'Features and columns can be more discursive and personal, with an engaging opening and a byline; news reports aim to be impartial.');
  M('e1', 'What is a standfirst?',
    ['A short introductory summary below a headline, before the main text', 'The final sentence of an article', 'A photo caption', 'The writer\'s signature'], 0,
    'Common in articles and features, it tells the reader what the piece is about and draws them in.');

  // ---------- Language and rhetorical techniques ----------
  M('e2', '"We will rebuild. We will recover. We will return stronger." Which technique is used?',
    ['Anaphora and a tricolon', 'Oxymoron', 'Onomatopoeia', 'Passive voice'], 0,
    'Anaphora repeats a word or phrase at the start of clauses; a tricolon is a pattern of three. Together they create rhythm and emphasis.');
  M('e2', 'A group of words linked by meaning, e.g. "battle", "retreat", "ambush", "frontline", used about a football match is a',
    ['semantic field', 'syntactic parallelism', 'pun', 'euphemism'], 0,
    'Here the semantic field of war presents the match as a conflict.');
  M('e2', 'Addressing a mass audience as if speaking to one individual ("You deserve a break") is called',
    ['synthetic personalisation', 'third-person narration', 'hyperbole', 'ellipsis'], 0,
    'A common persuasive device in advertising and leaflets that creates a sense of a personal relationship.');
  M('e2', 'Which is an example of juxtaposition?',
    ['"Glass towers rose above tin-roofed shacks."', '"The wind whispered."', '"Buzz, hiss, crack."', '"It was as big as a house."'], 0,
    'Juxtaposition places contrasting ideas side by side for effect.');
  M('e2', '"The sea was a restless animal." This is a',
    ['metaphor', 'simile', 'alliteration', 'rhetorical question'], 0,
    'A direct comparison without "like" or "as". "The sea was like a restless animal" would be a simile.');
  M('e2', 'Which sentence is in the imperative mood?',
    ['"Book your tickets today."', '"Tickets are available now."', '"Have you booked yet?"', '"What a show!"'], 0,
    'Imperatives give commands or instructions. The others are declarative, interrogative and exclamative.');
  M('e2', '"Could", "might" and "should" are examples of',
    ['modal verbs', 'adverbs', 'pronouns', 'conjunctions'], 0,
    'Modal verbs express possibility, obligation or certainty, and can make a tone tentative or insistent.');
  M('e2', 'The word "register" in language analysis refers to',
    ['the level of formality and variety of language suited to context and audience', 'the number of words', 'the use of rhyme', 'the order of paragraphs'], 0,
    'E.g. formal register in an editorial, informal register in a personal blog.');
  M('e2', '"So", "anyway", "right then" and "firstly" are examples of',
    ['discourse markers', 'adjectives', 'modal verbs', 'fillers only'], 0,
    'Discourse markers organise speech or writing and signal shifts in topic.');
  M('e2', 'Which is an example of hyperbole?',
    ['"I\'ve told you a million times."', '"The door creaked."', '"She ran quickly."', '"It was cold."'], 0,
    'Hyperbole is deliberate exaggeration for emphasis or humour.');
  M('e2', 'Pre-modification in a noun phrase means',
    ['words placed before the head noun that describe it', 'a sentence with no verb', 'a clause beginning with "which"', 'repeating a noun'], 0,
    'In "the ancient, crumbling harbour wall", "ancient, crumbling harbour" pre-modifies "wall".');
  M('e2', 'A writer uses a one-word paragraph: "Nothing." What is the most likely structural effect?',
    ['It isolates and emphasises a moment, creating impact', 'It shows formality', 'It gives balanced evidence', 'It acts as a subheading'], 0,
    'Short paragraphs or minor sentences can slow the pace, create tension or emphasise a turning point.');
  M('e2', 'A persuasive text says "9 out of 10 dentists recommend...". Which appeal is this?',
    ['Logos (appeal to logic / evidence)', 'Pathos (emotion)', 'Ethos only (character)', 'Bathos'], 0,
    'Statistics are a logical appeal, although referring to experts also builds credibility (ethos).');

  // ---------- Extract-based analysis (Paper 1 Section B skills) ----------
  const travel = X('Extract A · Travel writing', `<p>The ferry coughed itself awake at dawn. I stood at the rail with my hands around a paper cup of sweet, scalding tea while the island slid out of the mist: first the lighthouse, then the scatter of blue doors, then the fishermen already shouting across the harbour. Nobody had told me it would smell of diesel and oranges. Nobody had told me I would want to stay.</p>`);
  M('e5', travel + 'What is the effect of "The ferry coughed itself awake"?',
    ['Personification makes the ferry seem alive and reluctant, setting a vivid, slightly humorous tone', 'It is a simile showing the ferry is old', 'It shows the writer is angry', 'It is a statistic that adds credibility'], 0,
    'Giving the ferry human actions creates a vivid opening and suggests the sound and effort of the engine starting.');
  M('e5', travel + 'How does the list "first the lighthouse, then the scatter of blue doors, then the fishermen" work structurally?',
    ['It reveals the island gradually, as the writer would see it, building a sense of arrival', 'It gives instructions to the reader', 'It lists facts in order of importance', 'It is a quotation from a witness'], 0,
    'The ordered, cumulative list mimics the view emerging from the mist.');
  M('e5', travel + 'What is the effect of the repeated "Nobody had told me..." at the end?',
    ['Anaphora emphasises the writer\'s surprise and builds to an emotional revelation', 'It shows the writer is complaining', 'It introduces a counter-argument', 'It is a convention of a news story'], 0,
    'The parallel sentences move from the sensory (smell) to the emotional (wanting to stay), a typical travel-writing move from place to reflection.');
  M('e5', travel + 'Which conventions of travel writing does the extract show?',
    ['First-person perspective, sensory detail and personal reflection', 'Headline and lead paragraph', 'Bullet points and contact details', 'Speaker labels'], 0,
    'Note "I stood", the smell/taste/sight details and the closing reflection.');

  const ad = X('Extract B · Leaflet for a city bike scheme', `<p><b>Tired of traffic? Skip it.</b></p><p>Grab a bike from any of our 120 docking stations. Ride for 30 minutes free. Drop it off anywhere in the city.</p><p>Cleaner air. Quicker journeys. Healthier you.</p><p>Download the CityCycle app today.</p>`);
  M('e5', ad + 'Why does the leaflet open with a question?',
    ['A rhetorical question addresses a problem the reader recognises and invites them in', 'To test the reader\'s knowledge', 'To introduce a counter-argument', 'Because leaflets must begin with questions'], 0,
    'The question identifies a pain point and the minor sentence "Skip it." answers it with a simple, confident solution.');
  M('e5', ad + '"Grab", "Ride", "Drop" and "Download" are all',
    ['imperative verbs that give direct instructions and a call to action', 'past tense verbs', 'modal verbs', 'nouns'], 0,
    'Imperatives create urgency and make the process sound simple.');
  M('e5', ad + 'What is the effect of "Cleaner air. Quicker journeys. Healthier you."?',
    ['A tricolon of minor sentences lists benefits in a memorable, punchy rhythm', 'It is a formal conclusion', 'It shows balance between arguments', 'It is a quotation from an expert'], 0,
    'Comparative adjectives (cleaner, quicker, healthier) imply improvement, and the shift to "you" personalises the final benefit.');

  const pod = X('Extract C · Podcast transcript', `<p><b>MAYA:</b> so (.) welcome back to <i>Kitchen Table</i> (.) um today we're talking about (.) well (.) food waste<br><b>DEV:</b> which is (.) honestly (.) a bit grim<br><b>MAYA:</b> [laughs] it is a bit grim but stay with us<br><b>DEV:</b> yeah yeah (.) so I did this thing right (.) I weighed everything I threw away for a week and</p><p class="small">(.) = short pause · [ ] = paralinguistic feature</p>`);
  M('e5', pod + 'Which features show that this is spontaneous speech?',
    ['Fillers (um), pauses, repetition (yeah yeah) and self-correction (well)', 'Formal register throughout', 'Subheadings', 'Complete, carefully punctuated sentences'], 0,
    'Non-fluency features and discourse markers ("so", "right") are typical of unscripted talk.');
  M('e5', pod + 'What is the function of "stay with us"?',
    ['Direct address to listeners that keeps them engaged', 'An instruction to Dev', 'A formal sign-off', 'A statistic'], 0,
    'Podcasts construct a relationship with an unseen audience through direct address and an informal, friendly register.');

  const news = X('Extract D · News story', `<p><b>Floods force 300 from homes</b></p><p>More than 300 residents of Riverside were evacuated on Tuesday night after the River Lune burst its banks following two days of heavy rain.</p><p>Emergency crews used boats to reach families trapped on upper floors. "The water came up faster than anyone expected," said fire officer Lena Ortiz.</p>`);
  M('e5', news + 'Which conventions of a news story are shown?',
    ['Headline, factual lead paragraph and an attributed quotation', 'First-person reflection and sensory description', 'Star rating and verdict', 'Greeting and sign-off'], 0,
    'The lead answers who, what, where, when and why in one sentence; the quotation adds a human voice and credibility.');
  M('e5', news + 'Why is the headline written as "Floods force 300 from homes" rather than a full sentence?',
    ['Headlines are compressed (omitting articles) for impact and space', 'It is a spelling error', 'It shows the writer\'s opinion', 'It is a question'], 0,
    'Headlinese drops function words and uses strong, short verbs such as "force".');

  // ---------- Directed response and comparison (Paper 1 Section A) ----------
  M('e3', 'In Paper 1 Question 1(a), what is the required length of the directed response?',
    ['150–200 words', '400–500 words', '600–900 words', 'No limit'], 0,
    'Keeping to 150–200 words is assessed as part of relevance to purpose.');
  M('e3', 'A Q1(a) task asks you to turn a travel article into a diary entry. What is most important?',
    ['Adapting form, register and voice to the new text type, audience and purpose while using the original content', 'Copying the best sentences from the original', 'Writing as much as possible', 'Keeping the same headline and structure'], 0,
    'Directed response rewards a new text that fits its form and purpose and draws selectively on the source material.');
  M('e4', 'In Q1(b), you compare your directed response with the original text. What should you focus on?',
    ['How form, structure and language differ and why, linked to audience and purpose', 'Which text is better', 'Retelling the content of both texts', 'Spelling errors in the original'], 0,
    'Compare stylistic choices with examples from both texts and explain their effects in context.');
  M('e4', 'Which sentence is the strongest comparative point for Q1(b)?',
    ['"While the article uses third-person description to inform readers, my diary uses first-person minor sentences ("Couldn\'t sleep.") to convey private anxiety."', '"My text is shorter than the original."', '"Both texts are about a festival."', '"I used good words in my text."'], 0,
    'It names the feature in both texts, quotes, and links the difference to purpose and audience.');

  SELF('e3', `<b>Q1(a) style task.</b> Read Extract A (travel writing) again:<br>${travel}<br>The writer later posts on their travel <b>blog</b>, recommending the island to young backpackers on a budget. Write the opening of the blog post (150–200 words), using details from the extract.`,
    ['Blog conventions: title, first person, direct address to readers, informal register', 'Clear audience (young budget backpackers) and purpose (recommend)', 'Uses and adapts details from the extract (ferry, harbour, blue doors, smells)', 'Stays within 150–200 words', 'Accurate, controlled expression'],
    'A strong response sounds like a real blog: a catchy title, a chatty first-person voice ("Trust me, you need this ferry at dawn"), practical tips for a budget, and selected sensory details from the original, all within the word range.', [1]);
  SELF('e4', `<b>Q1(b) style task.</b> Compare the style of your blog post with Extract A. Refer to form, structure and language. (Aim for about 3 developed comparative paragraphs.)`,
    ['Compares specific features in BOTH texts with brief quotations', 'Explains differences in form (literary travel writing vs blog)', 'Explains differences in structure (e.g. reflective ending vs tips / headings)', 'Explains language choices (e.g. imagery vs direct address, register)', 'Links every difference to audience, purpose and context'],
    null, [1]);
  SELF('e5', `<b>Q2 style task.</b> Analyse Extract B (leaflet):<br>${ad}<br>Analyse how the writer uses form, structure and language to persuade the reader. (Write a plan or a full answer.)`,
    ['Identifies form, audience (city commuters) and purpose (persuade to use bikes)', 'Structure: problem-solution opening, short sections, benefits, final call to action', 'Language: rhetorical question, imperatives, minor sentences, tricolon, comparative adjectives', 'Uses precise terminology with embedded quotations', 'Explains effects on the reader, not just naming features', 'Coherent overview and conclusion'],
    null, [1]);
  SELF('e5', `<b>Q2 style task.</b> Analyse Extract C (podcast transcript):<br>${pod}<br>How do the speakers use language and structure to engage their listeners?`,
    ['Identifies context: informal podcast, two hosts, listeners who cannot see them', 'Spoken features: fillers, pauses, discourse markers, repetition, laughter', 'Turn-taking and co-operation between hosts (humour, agreement)', 'Direct address ("stay with us") and personal anecdote to create rapport', 'Terminology plus quotation plus effect in each point'],
    null, [1]);

  // ---------- Paper 2 Writing ----------
  M('e6', 'Paper 2 Section A is made up of',
    ['a shorter piece of writing and a reflective commentary on your own language choices', 'a text analysis of an unseen extract', 'a directed response of 150–200 words', 'two essays'], 0,
    'Section A tests writing for a specific task and then reflecting on how your choices fulfil it.');
  M('e7', 'A strong reflective commentary mainly',
    ['explains how your specific language and structural choices suit the task, audience and purpose, with examples from your own writing', 'summarises the plot of your writing', 'evaluates whether you enjoyed the task', 'analyses a published text'], 0,
    'Quote your own choices and explain their intended effect.');
  M('e7', 'Which is the best sentence for a reflective commentary?',
    ['"I opened with the minor sentence \'Silence.\' to create immediate tension and make the reader question what has happened."', '"My story was about a girl who got lost."', '"I think my writing is really good."', '"The text uses lots of techniques."'], 0,
    'It names a specific choice, quotes it, and explains its effect on the reader.');
  M('e8', 'In Paper 2 Section B, what length is the extended writing task?',
    ['600–900 words', '150–200 words', '400 words', '1500 words'], 0,
    'Section B is a single extended response chosen from three options.');
  M('e8', 'Which technique best creates tension at the opening of a story?',
    ['Starting in medias res with a short, unexplained action', 'Beginning with a long description of the weather', 'Summarising the whole plot first', 'Using many rhetorical questions to the reader'], 0,
    'Starting in the middle of the action with information withheld makes the reader want to know more.');
  M('e8', 'Which advice best suits descriptive writing?',
    ['Build atmosphere using precise sensory detail and a clear structure (e.g. moving through space or time)', 'Include lots of dialogue and plot twists', 'State your argument in the first line', 'Use bullet points'], 0,
    'Description should show rather than tell, with varied sentences and controlled imagery.');
  M('e9', 'What is the main difference between discursive and argumentative writing?',
    ['Discursive explores several viewpoints in a balanced way; argumentative argues for one position', 'They are the same', 'Argumentative must be fictional', 'Discursive never has a conclusion'], 0,
    'Discursive writing weighs up perspectives before reaching a considered view; argumentative writing takes a clear stance and uses counter-arguments to rebut them.');
  M('e9', 'Which is the best opening for an argumentative article on banning phones in schools?',
    ['"Every lesson, thousands of students lose the fight against a buzzing pocket, and it is time schools stopped pretending otherwise."', '"In this essay I will talk about phones."', '"Phones are things that people have."', '"There are good points and bad points."'], 0,
    'It hooks the reader, signals a clear stance and establishes a confident voice.');
  M('e9', 'In an argumentative piece, why include a counter-argument?',
    ['To acknowledge and then rebut an opposing view, strengthening your case', 'To show you have not decided', 'To make the piece longer', 'It should never be included'], 0,
    'Rebuttal shows awareness of the debate and makes your position more credible.');
  M('e10', 'Which sentence uses a semicolon correctly?',
    ['"The storm had passed; the damage remained."', '"The storm; had passed."', '"I bought; eggs, milk and bread."', '"Because it rained; we stayed in."'], 0,
    'A semicolon links two closely related independent clauses.');
  M('e10', 'Which choice would suit a formal letter of complaint to a council?',
    ['A polite, formal register with a clear purpose in the first paragraph and a specific request', 'Slang and emojis', 'A narrative with dialogue', 'A tricolon of insults'], 0,
    'Register must suit audience and purpose. State the problem, give evidence, request action.');
  M('e10', 'Varying sentence length in writing is mainly used to',
    ['control pace and emphasis', 'increase the word count', 'avoid paragraphs', 'show formality'], 0,
    'Long complex sentences can build detail; short sentences create impact or tension.');

  SELF('e6', `<b>Section A style task.</b> Write the <b>opening of a short story</b> set in a busy market at night, which creates a sense of mystery. Then write a reflective commentary explaining your language choices.`,
    ['Story opening establishes setting and character with sensory detail', 'Creates mystery: withheld information, unusual detail, tension', 'Controlled narrative voice and tense', 'Varied sentence structures for effect', 'Commentary quotes your own choices and explains their intended effects on the reader', 'Commentary links choices to the task (mystery, setting)'],
    null, [2]);
  SELF('e6', `<b>Section A style task.</b> Write a <b>speech</b> to be given by a student to new students on their first day at your school, persuading them to join a club. Then write a reflective commentary on how your choices suit the audience and purpose.`,
    ['Spoken conventions: greeting, direct address, inclusive pronouns, clear signposting', 'Rhetorical devices: rhetorical questions, tricolon, anecdote, humour', 'Register suited to nervous new students (friendly, encouraging)', 'Clear ending with call to action', 'Commentary uses quotations from your speech and explains their effect', 'Commentary links choices to audience and purpose'],
    null, [2]);
  SELF('e8', `<b>Section B style task (imaginative).</b> Write a story called <i>The Last Train</i>. (600–900 words)`,
    ['Engaging opening that establishes voice, setting and hook', 'Developed characterisation (thoughts, actions, dialogue)', 'Shaped structure: build-up, turning point, satisfying ending', 'Controlled pacing, e.g. varied sentences and paragraphs', 'Imagery and precise vocabulary without overwriting', 'Accurate spelling, punctuation and grammar'],
    null, [2]);
  SELF('e8', `<b>Section B style task (descriptive).</b> Describe a place just before a storm arrives. (600–900 words)`,
    ['Focus on atmosphere rather than plot', 'Detailed sensory description (sight, sound, smell, touch)', 'Clear structure, e.g. change over time as the storm approaches', 'Imagery (metaphor, personification) used with control', 'Varied sentence structures for rhythm and tension', 'Accurate expression'],
    null, [2]);
  SELF('e9', `<b>Section B style task (discursive).</b> Write an article for a magazine discussing whether social media does more harm than good to young people. (600–900 words)`,
    ['Article conventions: headline, engaging opening, clear paragraphs', 'Balanced exploration of several viewpoints with examples', 'Logical progression with discourse markers', 'Register suited to a magazine readership', 'Considered conclusion that weighs the arguments', 'Accurate, varied expression'],
    null, [2]);
  SELF('e9', `<b>Section B style task (argumentative).</b> Write a speech arguing that your town should ban cars from its centre. (600–900 words)`,
    ['Clear, sustained position from the opening', 'Persuasive techniques used purposefully (evidence, anecdote, rhetorical questions, tricolon)', 'Counter-argument acknowledged and rebutted', 'Speech conventions: address to audience, signposting, memorable ending', 'Coherent structure building to a strong conclusion', 'Accurate expression'],
    null, [2]);
})();
