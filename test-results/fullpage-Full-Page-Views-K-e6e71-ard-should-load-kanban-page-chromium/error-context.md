# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - link "Dashboard" [ref=e7] [cursor=pointer]:
        - /url: /dashboard
        - button "Dashboard" [ref=e8]:
          - img
          - text: Dashboard
      - generic [ref=e10]:
        - img [ref=e12]
        - generic [ref=e13]:
          - heading "Kanban Board" [level=1] [ref=e14]
          - paragraph [ref=e15]: Track assigned tasks by status
    - generic [ref=e16]:
      - generic [ref=e17]:
        - img [ref=e18]
        - textbox "Search tasks..." [ref=e21]
      - combobox [ref=e22]:
        - img
        - img
      - combobox [ref=e23]
      - combobox [ref=e24]:
        - img
        - img
      - combobox [ref=e25]
      - button [ref=e26]:
        - img
      - link "TaskPool" [ref=e27] [cursor=pointer]:
        - /url: /taskpool-board
        - button "TaskPool" [ref=e28]:
          - img
          - text: TaskPool
      - button [ref=e29]:
        - img
  - region "Notifications alt+T"
```