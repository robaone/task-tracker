Feature: List Tasks

  Scenario: List tasks filtered by status "in_progress"
    Given the task tracker is initialized
    And tasks exist with the following statuses:
      | id       | title          | status       |
      | TASK-001 | Fix login bug  | in_progress  |
      | TASK-002 | Write tests    | todo         |
      | TASK-003 | Deploy v2      | in_progress  |
    When I run "task-tracker list --status in_progress"
    Then the output should contain "TASK-001"
    And the output should contain "TASK-003"
    And the output should not contain "TASK-002"

  Scenario: List pending tasks
    Given the task tracker is initialized
    And tasks exist with the following statuses:
      | id       | title            | status       |
      | TASK-001 | Fix login bug    | in_progress  |
      | TASK-002 | Write tests      | todo         |
      | TASK-003 | Deploy v2        | done         |
      | TASK-004 | Refactor auth    | todo         |
    When I run "task-tracker list todo"
    Then the output should contain "TASK-002"
    And the output should contain "TASK-004"
    And the output should not contain "TASK-001"
    And the output should not contain "TASK-003"

  Scenario: List completed tasks
    Given the task tracker is initialized
    And tasks exist with the following statuses:
      | id       | title            | status       |
      | TASK-001 | Fix login bug    | in_progress  |
      | TASK-002 | Write tests      | todo         |
      | TASK-003 | Deploy v2        | done         |
      | TASK-004 | Refactor auth    | todo         |
      | TASK-005 | Update deps      | done         |
    When I run "task-tracker list done"
    Then the output should contain "TASK-003"
    And the output should contain "TASK-005"
    And the output should not contain "TASK-001"
    And the output should not contain "TASK-002"
    And the output should not contain "TASK-004"
