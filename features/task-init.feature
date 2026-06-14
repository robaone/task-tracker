Feature: Initialize Task Tracker

  Scenario: Initialize with local JSON backend
    Given no task tracker is configured
    When I run "task-tracker init"
    Then I should be prompted to select a backend
    And the available backends should include "json"
    When I select "json"
    Then I should be prompted for the storage path
    When I enter "/home/user/tasks.json"
    Then a configuration file ".task-tracker.json" should be created
    And the configuration should specify backend "json" with path "/home/user/tasks.json"
    And the file "tasks.json" should exist and contain an empty task list
