Feature: Download Task

  Scenario: Download a specific task by ID
    Given the task tracker is initialized
    And a task exists with id "TASK-001" and title "Fix login bug"
    When I run "task-tracker download -o /tmp/export.json TASK-001"
    Then the file "/tmp/export.json" should exist
    And the file "/tmp/export.json" should contain a task with id "TASK-001"
