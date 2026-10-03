function returnedFacts(contexts, tag) {
  const facts = [];
  for (const context of contexts || []) {
    if (typeof context !== 'string') continue;
    const block = context.match(
      new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`),
    )?.[1];
    if (!block) continue;
    let scope = tag === 'supermemory-recall' ? 'prompt' : 'profile';
    for (const line of block.split('\n')) {
      if (line.startsWith('## User Profile')) scope = 'profile';
      if (line.startsWith('## Recent Context')) scope = 'recent';
      const text = line.match(/^- ◪ (.+)$/)?.[1];
      if (text) facts.push({ scope, text });
    }
  }
  return facts;
}

function shortLabel(text) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > 22 ? `${trimmed.slice(0, 21).trimEnd()}…` : trimmed;
}

export function register(on) {
  let facts = [];
  let selected = -1;
  let browse = false;

  on('classic.SessionStart', async ($, e, next) => {
    facts = [];
    selected = -1;
    browse = false;
    const result = await next(e);
    facts = returnedFacts(result.additionalContext, 'supermemory-context');
    $.ui.invalidate('ui.render');
    return result;
  });

  on('classic.UserPromptSubmit', async ($, e, next) => {
    const result = await next(e);
    facts = returnedFacts(result.additionalContext, 'supermemory-recall');
    selected = -1;
    browse = false;
    $.ui.invalidate('ui.render');
    return result;
  });

  on(
    'ui.render',
    { component: 'AbovePrompt', surface: 'terminal' },
    async ($, e, next) => {
      const original = await next(e);
      if (e.props.hasSurvey || facts.length === 0) return original;

      const { Box, Text, Button } = $.ui.resolve(e);
      const width = Math.max(24, Math.min(64, e.props.bodyColumns - 4));
      const chip = (fact, index) =>
        Box({
          key: `recall-${index}`,
          marginRight: 2,
          flexDirection: 'column',
          children: [
            Button({
              key: `recall-button-${index}`,
              label: `${fact.scope}: ${shortLabel(fact.text)}`,
              plain: true,
              dimColor: true,
              onPress: () => {
                selected = selected === index ? -1 : index;
                $.ui.invalidate('ui.render');
              },
            }),
            Box({
              display: 'none',
              hover: { display: 'flex' },
              flexDirection: 'column',
              borderStyle: 'round',
              borderDimColor: true,
              paddingX: 1,
              width,
              children: Text({ wrap: 'wrap', children: fact.text }),
            }),
          ],
        });

      const shown = browse ? facts : facts.slice(0, 2);
      const items = shown.map(chip);
      if (facts.length > 2) {
        items.push(
          Button({
            key: 'recall-more',
            label: browse ? 'less' : `+${facts.length - 2} more`,
            plain: true,
            dimColor: true,
            onPress: () => {
              browse = !browse;
              selected = -1;
              $.ui.invalidate('ui.render');
            },
          }),
        );
      }

      return Box({
        flexDirection: 'column',
        children: [
          Box({
            flexDirection: 'row',
            flexWrap: 'wrap',
            children: [
              Text({ color: 'cyan', dimColor: true, children: '◪ recalled  ' }),
              ...items,
            ],
          }),
          selected >= 0 && selected < facts.length
            ? Box({
                borderStyle: 'round',
                borderDimColor: true,
                paddingX: 1,
                width,
                children: Text({
                  wrap: 'wrap',
                  children: facts[selected].text,
                }),
              })
            : null,
        ],
      });
    },
  );
}
