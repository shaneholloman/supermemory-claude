function returnedFacts(contexts, tag) {
  const facts = [];
  for (const context of contexts || []) {
    if (typeof context !== 'string') continue;
    const block = context.match(
      new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`),
    )?.[1];
    if (!block) continue;
    let current = -1;
    for (const line of block.split('\n')) {
      if (
        line.startsWith('## User Profile') ||
        line.startsWith('## Recent Context')
      ) {
        current = -1;
        continue;
      }
      const text = line.match(/^- ◪ (.+)$/)?.[1];
      if (text) {
        current = facts.length;
        facts.push(text);
      } else if (tag === 'supermemory-context' && current >= 0) {
        facts[current] += `\n${line}`;
      }
    }
  }
  return facts.map((fact) => fact.trimEnd());
}

export function register(on) {
  let facts = [];
  let expanded = false;

  on('classic.SessionStart', async ($, e, next) => {
    facts = [];
    expanded = false;
    try {
      const result = await next(e);
      facts = returnedFacts(result.additionalContext, 'supermemory-context');
      return result;
    } finally {
      $.ui.invalidate('ui.render');
    }
  });

  on('classic.UserPromptSubmit', async ($, e, next) => {
    try {
      facts = [];
      expanded = false;
      const result = await next(e);
      facts = returnedFacts(result.additionalContext, 'supermemory-recall');
      return result;
    } finally {
      $.ui.invalidate('ui.render');
    }
  });

  on(
    'ui.render',
    { component: 'AbovePrompt', surface: 'terminal' },
    async ($, e, next) => {
      const original = await next(e);
      if (e.props.hasSurvey || facts.length === 0) return original;

      const { Box, Text, Button } = $.ui.resolve(e);
      const width = Math.min(
        e.props.bodyColumns,
        Math.max(1, Math.min(64, e.props.bodyColumns - 4)),
      );

      return Box({
        flexDirection: 'column',
        children: [
          original,
          Button({
            key: 'recall-details',
            label: `◪ ${facts.length} recalled ${expanded ? '▴' : '▾'}`,
            plain: true,
            dimColor: true,
            onPress: () => {
              expanded = !expanded;
              $.ui.invalidate('ui.render');
            },
          }),
          expanded
            ? Box({
                paddingX: 1,
                width,
                children: Text({
                  wrap: 'wrap',
                  dimColor: true,
                  children: facts.map((fact) => `◪ ${fact}`).join('\n\n'),
                }),
              })
            : null,
        ],
      });
    },
  );
}
