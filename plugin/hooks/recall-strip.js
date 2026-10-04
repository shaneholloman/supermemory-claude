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
  let active = 0;

  on('classic.SessionStart', async ($, e, next) => {
    facts = [];
    expanded = false;
    active = 0;
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
      active = 0;
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
      const label =
        e.props.bodyColumns < 32
          ? `◪ ${facts.length} clarified`
          : `◪ supermemory clarified ${facts.length} ${facts.length === 1 ? 'thing' : 'things'}`;

      return Box({
        flexDirection: 'column',
        children: [
          original,
          Button({
            key: 'recall-details',
            label: `${label} ${expanded ? '▴' : '▾'}`,
            plain: true,
            dimColor: true,
            onPress: () => {
              expanded = !expanded;
              if (expanded) active = 0;
              $.ui.invalidate('ui.render');
            },
          }),
          expanded
            ? Box({
                paddingX: 1,
                width,
                flexDirection: 'column',
                children: [
                  Text({ wrap: 'wrap', children: facts[active] }),
                  facts.length > 1
                    ? Box({
                        flexDirection: 'row',
                        children: [
                          Button({
                            key: 'recall-previous',
                            label: '‹',
                            plain: true,
                            dimColor: true,
                            onPress: () => {
                              active =
                                (active - 1 + facts.length) % facts.length;
                              $.ui.invalidate('ui.render');
                            },
                          }),
                          Text({
                            dimColor: true,
                            children: ` ${active + 1}/${facts.length} `,
                          }),
                          Button({
                            key: 'recall-next',
                            label: '›',
                            plain: true,
                            dimColor: true,
                            onPress: () => {
                              active = (active + 1) % facts.length;
                              $.ui.invalidate('ui.render');
                            },
                          }),
                        ],
                      })
                    : null,
                ],
              })
            : null,
        ],
      });
    },
  );
}
