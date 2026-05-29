import re

with open('CardListScreen.tsx', 'r') as f:
    content = f.read()

old = '''            multiple={true}
          />
        )}
      </div>'''

new = '''            multiple={true}
          />
          <Dropdown
            label="Secondary"
            options={[
              { key: 'ja', label: 'Japanese' },
              { key: 'en', label: 'English' },
              { key: 'es', label: 'Spanish' },
            ]}
            selected={[secondaryLang]}
            onChange={(vals) => vals[0] && handleSecondaryLangChange(vals[0] as SecondaryLanguage)}
            multiple={false}
          />
        )}
      </div>'''

content = content.replace(old, new)

with open('CardListScreen.tsx', 'w') as f:
    f.write(content)

print('Done')