Feature: Review Prep

  Prepare a code review context bundle from a task. This is the primary
  workflow command for the project — given a task ID, it fetches the task
  details, comments, attachments, and references from the configured backend,
  computes the git diff, and packages everything into a structured directory.

  Scenario: Prepare full review context for a task
    Given the task tracker is initialized
    And a task exists with id "TASK-001" and title "Fix login bug"
    And task "TASK-001" has the following details:
      | field       | value                       |
      | description | Users cannot log in after   |
      |             | the session timeout change  |
      | status      | in_progress                 |
      | priority    | high                        |
      | labels      | bug, auth                   |
    And task "TASK-001" has 2 comments
    And task "TASK-001" has 1 attachment named "session-config.png"
    And task "TASK-001" has 1 reference "DOC-001: Auth Architecture"
    When I run "task-tracker review-prep TASK-001 --base main --out $TEMP/review-task-001"
    Then the directory "$TEMP/review-task-001" should exist
    And the directory "$TEMP/review-task-001/attachments" should exist
    And the file "$TEMP/review-task-001/context.md" should exist
    And the file "$TEMP/review-task-001/context.md" should contain "Fix login bug"
    And the file "$TEMP/review-task-001/context.md" should contain "in_progress"
    And the file "$TEMP/review-task-001/context.md" should contain "Users cannot log in"
    And the file "$TEMP/review-task-001/context.md" should contain the git diffstat
    And the file "$TEMP/review-task-001/context.md" should contain the git diff
    And the file "$TEMP/review-task-001/ticket.json" should exist
    And the file "$TEMP/review-task-001/diff.patch" should exist
    And the file "$TEMP/review-task-001/attachments/session-config.png" should exist

  Scenario: Prepare review context for a task with no comments or attachments
    Given the task tracker is initialized
    And a task exists with id "TASK-002" and title "Update deps"
    And task "TASK-002" has no comments
    And task "TASK-002" has no attachments
    When I run "task-tracker review-prep TASK-002 --out $TEMP/review-task-002"
    Then the file "$TEMP/review-task-002/context.md" should exist
    And the file "$TEMP/review-task-002/context.md" should contain "Update deps"
    And the file "$TEMP/review-task-002/context.md" should not contain "## Comments"
    And the directory "$TEMP/review-task-002/attachments" should be empty

  Scenario: Review prep with explicit base branch overrides auto-detection
    Given the task tracker is initialized
    And a task exists with id "TASK-003" and title "Refactor auth"
    When I run "task-tracker review-prep TASK-003 --base develop --out $TEMP/review-task-003"
    Then the file "$TEMP/review-task-003/context.md" should contain "develop" within the diff section
    And the diff in "$TEMP/review-task-003/diff.patch" should be computed against "develop"

  Scenario: Error when task does not exist
    Given the task tracker is initialized
    When I run "task-tracker review-prep TASK-999 --out $TEMP/review-task-999"
    Then the command should exit with a non-zero exit code
    And the output should contain "not found"

  Scenario: Default output directory is review-<id>
    Given the task tracker is initialized
    And a task exists with id "TASK-004" and title "Fix typo"
    When I run "task-tracker review-prep TASK-004"
    Then a directory named "review-TASK-004" should exist in the current directory
