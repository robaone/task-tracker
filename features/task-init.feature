Feature: Initialize Task Tracker Configuration

  Configure the CLI to point at an existing task store. The CLI does
  not create or manage tasks — it reads from a backend that is
  managed externally.

  Scenario: Configure local JSON backend
    Given no task tracker is configured
    When I run "task-tracker init"
    Then I should be prompted to select a backend
    And the available backends should include "json"
    When I select "json"
    Then I should be prompted for the path to an existing tasks JSON file
    When I enter "/home/user/tasks.json"
    Then a configuration file ".task-tracker.json" should be created
    And the configuration should specify backend "json" with path "/home/user/tasks.json"
    And no files should be created or modified at "/home/user/tasks.json"

  Scenario: Configure GitHub Issues backend
    Given no task tracker is configured
    When I run "task-tracker init"
    Then I should be prompted to select a backend
    And the available backends should include "github"
    When I select "github"
    Then I should be prompted for the repository and authentication token
    When I enter "my-org/my-repo" and provide a token
    Then a configuration file ".task-tracker.json" should be created
    And the configuration should specify backend "github" with the given repo and token
