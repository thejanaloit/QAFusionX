# URS 1.1 Extracted


Account Module – Account Opening – Control for the Creation of Second or Subsequent Account for the same Customer from other Branches
User Story Document 

User story for Account Module – Account Opening – Control for the Creation of Second or Subsequent Account for the same Customer from other Branches

Document Version
1.1
Release Date
15/07/2026
Number of Pages
20

 HYPERLINK "https://www.lolc.com/technologies" 
LOLC Technologies Ltd
37 Rajagiriya Rd, Sri Jayawardenepura Kotte 10100
017780
Table of Contents

 TOC \o "1-3" \h \z \u Table of Contents PAGEREF _Toc228266566 \h 2
List of Figures PAGEREF _Toc228266567 \h 2
1.Document Control PAGEREF _Toc228266568 \h 4
1.1.Document Information PAGEREF _Toc228266569 \h 4
1.2.Revision History PAGEREF _Toc228266570 \h 4
1.3.Definitions and Acronyms PAGEREF _Toc228266571 \h 4
1.4.Assumptions PAGEREF _Toc228266572 \h 4
1.5.Risks PAGEREF _Toc228266573 \h 4
1.6.General Guide Line PAGEREF _Toc228266574 \h 5
2.Open Questions PAGEREF _Toc228266575 \h 5
3.Overview/Project Description PAGEREF _Toc228266576 \h 6
4.Scope PAGEREF _Toc228266577 \h 7
4.1.What is in-scope PAGEREF _Toc228266578 \h 7
4.2.What is out of scope PAGEREF _Toc228266579 \h 8
5.Epic: Narrative and Statement PAGEREF _Toc228266580 \h 8
6.Features/Stories PAGEREF _Toc228266581 \h 10
6.1.Story 01 – Other Branch Account Opening Workflow PAGEREF _Toc228266582 \h 10
6.2.Story 02 – Activate Account: Other Branch Approval Workflow (Pending & Rejected) PAGEREF _Toc228266585 \h 12
6.Data Dictionary PAGEREF _Toc228266586 \h 15
7.Diagrams and Examples PAGEREF _Toc228266587 \h 15
8.Annexure PAGEREF _Toc228266588 \h 19

List of Figures

 TOC \h \z \c "Figure" Figure 1: Flow Chart PAGEREF _Toc228277633 \h 6
Figure 2 – Sample UI – Activate Account Pending Tab (with Current Stage Column) PAGEREF _Toc228277634 \h 13
Figure 3 - Sample UI – Pending Other Branch Opening  – Customer Details Stepper PAGEREF _Toc228277635 \h 14
Figure 4- Sample UI – Pending Other Branch Opening- Product Details Stepper PAGEREF _Toc228277636 \h 14
Figure 5 - Sample UI – Pending Other Branch Opening - Account Details Stepper- Basic Account Details PAGEREF _Toc228277637 \h 15
Figure 6 - Sample UI – Pending Other Branch Opening – Account Details Stepper – Control & Restrictions PAGEREF _Toc228277638 \h 15
Figure 7 - Sample UI- Pending Other Branch Opening – Account Details Stepper – Account Purpose PAGEREF _Toc228277639 \h 16
Figure 8 - Sample UI- Pending Other Branch Opening – Account Details Stepper – Source of Funds PAGEREF _Toc228277640 \h 16
Figure 9- Sample UI - Pending Other Branch Opening -Confirmation Screen PAGEREF _Toc228277641 \h 17
Figure 10 - Sample UI - Other Branch Approval Rejected Tab PAGEREF _Toc228277642 \h 17

Document Control
Document Information
Drafted By
Chaniru Weerakoon 
Reviewed By
Bandula Ranasinghe   
Document Status
final
Client Name
LOLC Technologies Pvt Ltd
Circulation
Internal

Revision History
Revision Date
Updated By
Version
Section(s)
Description
05/05/2026

1.0
All
Reviewed URS
15/07/2026
Chaniru Weerakoon
1.1
All
Updated to reflect consolidated Activate Account screen: Pending Other Branches Opening and Rejected Other Branches Opening tabs merged into the Activate Account screen; new Current Stage column added to Pending tab (Pending Other Branch Approval / Pending Special Rate Approval / Ready to Activate); Special Rate Status column retained; Action standardised to a common ‘Proceed’ label; Rejected Other Branches Opening renamed to ‘Other Branch Approval Rejected’ and repositioned after ‘Special Rate Rejected’ tab.

Definitions and Acronyms 
Assumptions

The Fusion X system is capable of identifying whether a customer holds an existing account in a different branch at the point of customer selection during account opening.
The workflow engine in Fusion X supports configurable approval levels and can be set up for this rule prior to go-live.
User roles and permissions required to approve or reject other-branch account opening requests are already configured in the system.
The Account Activation sub-menu is stable and capable of supporting the addition of new tabs.
All displayed account and customer details in the approval stepper are already available in the system and can be rendered in read-only mode.
The standard account activation and special rate approval process is stable and will remain unchanged for accounts that proceed without requiring other-branch approval.
System audit logging is enabled and capable of capturing all user actions related to other-branch account opening, approvals, rejections, and account activation.
The Opening Account module and account creation process are stable and functional prior to implementation of this feature.
Risks

Incorrect workflow configuration (e.g., wrong approval levels or rule parameters) may cause requests to be routed improperly or blocked unintentionally.
Delays in approval by authorized users may result in customers experiencing unnecessary wait times during account opening.
If audit logging is not properly enabled, compliance and traceability requirements may not be met.
Dependency on manual approval introduces a risk of human error during approve or reject actions.
If the workflow rule is not configured before go-live, the system will have no control over cross-branch account openings.
System performance issues in the Activate Account Pending tab, which now carries the Current Stage tracking for all workflow types, may impact timely processing of approval requests.
Inadequate user training may lead to incorrect approval or rejection of other-branch account opening requests.
System performance issues in confirmation lists may impact timely approval of restriction requests.
General Guide Line 
Category
Guideline / Comment
Applicability / Notes
Data Management
All lists/screens shall support sorting (Order By) and filtering by relevant fields. (By default, latest on Top)
Applies to Leads, Appraisals, Loans, Customers, etc.
Search
Consistent search functionality across all modules.
Search should handle partial matches and multiple fields.
Input Validation
Mandatory fields must be validated before saving; data formats and ranges enforced.
Applies to all create/update forms.
Workflow & Approvals
All approval flows must follow standard process (e.g., Lead → BM → Credit). Notifications/alerts trigger for pending approvals.
Configurable via workflow engine if applicable.
Audit & Traceability
All create/update/delete actions must be logged with user ID, timestamp, and action type.
Ensures regulatory compliance and traceability.
Reporting & Dashboards
Reports should be exportable (Excel/PDF). Dashboards reflect near real-time data.
Applies to all summary reports and key metrics.
Consistency & Usability
Screens follow same navigation, field naming, and layout standards.
Includes web and mobile views where applicable.

Open Questions

#
Date
Question
Owner
Status

Overview/Project Description

 This project strengthens customer account management controls within the Fusion X Account Module by introducing a configurable workflow that governs whether a second or subsequent account for the same customer, opened from a different branch, is blocked, requires approval, or proceeds directly — with approvals routed through a configurable number of authorization levels before activation. Rather than separate screens, this is managed through the existing Activate Account screen, where a Current Stage column tracks each record through other-branch approval, special rate approval, and activation via a single common Proceed action, with dedicated tabs for returned, rejected, and activated outcomes, and full audit logging throughout.

-23404327200
Figure  SEQ Figure \* ARABIC 1: Flow Chart
Scope
What is in-scope
Introduction of a configurable workflow rule to control the creation of second or subsequent accounts for the same customer from other branches.
Validation and blocking logic at the point of customer selection during account opening when the rule is configured as ‘Not Allowed’.
Approval routing with a configurable number of workflow levels when the rule is configured as ‘Allowed with Approval Required’.
Standard account activation flow when the rule is configured as ‘Allowed without Approval Required’.
Consolidation of other-branch account opening approvals into the existing ‘Activate Account’ → Pending tab, using a new ‘Current Stage’ column to indicate workflow position (Pending Other Branch Approval, Pending Special Rate Approval, Ready to Activate).
Introduction of a new ‘Other Branch Approval Rejected’ tab within the ‘Activate Account’ screen, positioned after the ‘Special Rate Rejected’ tab, replacing the standalone Rejected Other Branches Opening tab.
Read-only stepper view (Customer Details, Product Details, Account Details) for approvers to review account information before taking action.
Approval and rejection actions with a confirmation pop-up including notes capture.
Audit logging for all actions including blocking events, approval, rejection, and account activation.
What is out of scope
Changes to existing user roles, permissions, or access controls.
Modifications to the core account opening or account creation process beyond the workflow control described in this document.
Automatic approval of other-branch account opening requests without manual confirmation.
Integration with external systems or third-party compliance tools.
Epic: Narrative and Statement

Account Module 
Who
As a business user (e.g., bank officer)
Needs
To control the creation of second or subsequent accounts for the same customer from other branches in a governed manner, with configurable rules that either block, require approval, or allow such openings, while ensuring all actions are subject to workflow controls and full audit logging.
Product

Within the CASA module, the Account Activation sub-menu, and the Fusion X workflow engine configuration.

ROI
Which helps strengthen compliance controls, prevent unauthorized duplicate account creation across branches, improve operational governance, and ensure a fully auditable approval process for cross-branch account openings.

Features/Stories
Story 01 – Other Branch Account Opening Workflow

 User& Function

The user login into the system.
Then navigate to the ‘Account Module’ by clicking on the ‘Account Management’ menu icon of the Home Screen.
Then navigate to the ‘Opening Account’ tab under ‘Account Management’. 
 Login → Home Screen → Account Management  → Account Management→ Opening Account 

 Action

Current Process

New Process 
A workflow shall be introduced to control the creation of second or subsequent accounts for the same customer from other branches. The rule shall maintain two configurable parameters in the Fusion X workflow engine:
Whether same-customer account opening from other branches is Allowed or Not Allowed.
If Allowed, whether Approval is Required or Not Required.
 The workflow shall operate under the following three scenarios:
Scenario 01 - Not Allowed
If the rule is configured as 'Not Allowed', when a user selects a customer during account opening and the system detects that the customer already holds an account in a different branch, the system shall:
Display “Account opening cannot be processed. This customer already holds an account at another branch.” Validation message. 
Block the account opening from proceeding further.
Scenario 02 - Allowed with Approval Required
If the rule is configured as 'Allowed' and 'Approval Required', the account opening request shall be submitted and routed through the configured approval workflow. 
Accounts opened in a different branch and pending approval should be visible to the customer’s original branch. For example, if a customer from Branch A opens an account in Branch B, users in Branch A should be able to view the pending approval and approve the account.
The following rules shall apply:
The approval workflow shall support a configurable number of approval levels (e.g., single-level or multi-level).
The request shall remain in a Pending status until all configured approval levels are completed.
Once all approvals are obtained, the account shall proceed to the next stages: Special Rate approval (if applicable) and Account Activation.
If the request is rejected at any approval level, the account opening shall not proceed and the request shall be marked as Rejected.
Scenario 3 - Allowed without Approval Required
If the rule is configured as 'Allowed' and 'No Approval Required', the account opening shall proceed directly, following the standard account activation and special rate approval process without any additional approval steps.
Audit and Logging
All actions related to other-branch account opening shall be logged for audit and compliance purposes.

Result

The system shall enforce the configured rule at the point of customer selection during account opening.
If 'Not Allowed', the opening shall be blocked with a validation message.
If 'Allowed with Approval', the request shall be routed through all configured workflow levels and proceed to activation only upon full approval.
If 'Allowed without Approval', the account shall follow the standard activation process without interruption.
Rejected requests shall not result in any account being created or activated.
All actions shall be recorded in the system audit log with User ID, Timestamp, Branch, and Action Type.
Pre-Conditions

The user shall be logged into the Fusion X system with valid credentials.
The user shall have the necessary authorization to perform account opening.
The workflow configuration for other-branch account opening shall be set up in the workflow engine prior to execution.
The customer record being selected shall already exist in the system with an active account linked to a different branch.
Trigger

The trigger point shall be when a user selects an existing customer during the account opening process and the system detects that the customer already holds an account in another branch.
Expected

If the rule is 'Not Allowed', the system shall display a validation message and prevent the account opening from proceeding.
If the rule is 'Allowed with Approval', the request shall be routed through all configured approval levels before proceeding to account activation.
If the rule is 'Allowed without Approval', the account shall proceed through the standard activation flow without interruption.
Rejected requests shall not result in any account creation or activation.
All actions shall be traceable in the audit log.

 Story 02 – Activate Account: Other Branch Approval Workflow (Pending & Rejected)
User& Function

The user login into the system.
Then navigate to the ‘Account Module’ by clicking on the ‘Account Management’ menu icon of the Home Screen.
Then navigate to the ‘Activate Account’ tab under ‘Account Management’. 

 Login → Home Screen → Account Management  → Account Management→ Activate Account
Action

                                    

Current Process
There is no dedicated screen or tab within the Account Activation sub-menu to manage approval of account opening requests originating from other branches. Approvers have no visibility into pending cross-branch account opening requests.
New Process
The existing ‘Activate Account’ screen (Account Management → Account Activation) shall be extended to manage other-branch account opening approvals, rather than introducing separate standalone tabs. The following updates shall be made:
Activate Account – Pending Tab
Other-branch account opening requests awaiting approval shall appear within the existing grid, alongside all other pending account activation requests, filtered to the logged-in user’s queue based on their approval level. Access to act on a record is controlled entirely by this queue visibility – the Proceed action is never disabled or blocked in the UI. 
Accounts opened in a different branch and pending approval should be visible to the customer’s original branch. For example, if a customer from Branch A opens an account in Branch B, users in Branch A should be able to view the pending approval and approve the account.
The grid shall display the following columns: (refer figure 2 )
Created Date and Time
Account Name
Account Number
Created User
Created Branch
Special Rate Status (No Special Rate / Pending / Approved)
Current Stage (Pending Other Branch Approval / Pending Special Rate Approval / Ready to Activate)
Status
Action (Proceed – common action label across all stages)
The user shall be able to search by Account Number and Customer Name.
Upon clicking the Action button for a record, the system shall navigate the user to a read-only stepper view of the account details. Only the following three steps shall be displayed.
Customer Details
Product Details
Account Details
Customer Details
When the user navigates to this stepper, the below fields shall be displayed in a grid format.(refer figure 3)
Section 1 – Customer Details 
Customer Name
Customer Code
Date of Birth
KYC
Ownership
Tax Percentage
Section 2- Nominee Details
Nominee Name
Nominee Code
Nominee Status
Identification
Relationships
Date of Birth
Portion%

Product Details
When the user navigates to this stepper, the below fields shall be displayed in a grid format.(refer figure 4)
Account Type
Main Product
Sub Product
Account Details
When the user navigates to this stepper, the below fields shall be displayed in a grid format.(refer figure 5 to 8)
Section 1 – Basic Account Details
Account Name
Account Nickname
Scheme Type
Account Number
Secondary Account Number
Anticipated Value
Anticipated Value Frequency
Account Currency
Account Description
Section 02 – Account Control
Account Balance Restriction
Foreign Currency
Section 03- Account Purpose
General/ Business Purpose
Remarks on Additional Account Opening
Section 04 – Source of Funds
Savings/ Salary/ Business Income
Other

All fields across the three steps shall be displayed in read-only mode. The approver shall be able to navigate between steps using Previous and Next buttons. No edits shall be permitted.
At the end of the stepper, a Confirm button shall be displayed. Upon clicking Confirm, a confirmation pop-up shall appear containing: ( refer figure 9)
Status options: Approve and Reject
Notes text box
Cancel and Confirm buttons
If the user selects Approve and clicks Confirm:
If further approval levels are configured, the request shall be escalated to the next approval level.
If this is the final configured approval level, the account shall proceed to Special Rate approval (if applicable) and Account Activation.
If the user selects Reject and clicks Confirm:
The request shall be marked as Rejected.
No account shall be created or activated.
The record shall move to the Other Branch Approval Rejected tab.

Other Branch Approval Rejected Tab
This tab shall be positioned within the Activate Account tab set immediately after the ‘Special Rate Rejected’ tab, and shall display all requests that were rejected at any approval level. The grid shall display the following columns: ( refer figure 10)
Created Date and Time
Account Number
Customer Name
Customer Code
Created Branch
Rejected By
Rejected Date and Time
Rejection Notes
This tab shall be read-only. No further actions shall be available on rejected records.
Note
Only the Users who have access to each status (Pending Other Branch Approval / Pending Special Rate Approval / Ready to Activate) which is defined in the Workflow shall have the visibility in the Front-end Screen ( Activate Account Screen). 
Result

The system shall update the status of the other-branch account opening request based on the approver's action.
Approved requests shall proceed to the next configured approval level or to account activation upon final approval.
Rejected requests shall be declined and recorded in the Other Branch Approval Rejected tab with no changes applied to the account.
All approval and rejection actions shall be logged for audit purposes with User ID, Timestamp, and Notes.
Pre-Conditions

The user shall be logged into the Fusion X system with valid credentials.
The user shall have authorization to access the Account Activation sub-menu and perform approval actions.
At least one other-branch account opening request shall exist in Pending status and be assigned to the logged-in user's approval level.
The workflow rule shall be configured as 'Allowed with Approval Required' in the Fusion X workflow engine.
Trigger

6.2.5.1.The trigger point shall be when the User clicks on the Approve / Reject action for a record in the Restriction Account Confirmation List.
6.2.6.Expected

6.2.6.1Approved restriction requests shall be successfully enforced on the account.
6Rejected restriction requests shall not impact the existing account status or transactions.
6.2.6.3. Users shall be able to review restriction details before approving or rejecting the request.
6.2.6.4. The system shall prevent unauthorized or incomplete approval actions.

Data Dictionary
N/A
E2E Impact Identification Table
Area
Example
Primary Module
Account Module – Opening Account (Cross-Branch Account Opening Control)
Upstream Touchpoints
Account Opening screen (customer selection step), Fusion X Workflow Engine (approval rule configuration)
Downstream Touchpoints
Activate Account screen – Pending tab (with Current Stage and Special Rate Status columns), Other Branch Approval Rejected tab, Special Rate Approval process, Account Activation process, System Audit Log
Reporting / MIS Impact
No direct MIS impact expected. However, audit logs generated from approval, rejection, and blocking events may feed into operational and compliance reports if configured.
Batch / Scheduler Impact
No batch or EOD process impact expected. All workflow actions are real-time and user-triggered.
Customer Impact
Yes – Customers opening a second or subsequent account from a different branch may experience a delay if the approval workflow is configured, or may be blocked entirely if the rule is set to Not Allowed.
Operational Impact
Yes – Branch officers will encounter a validation block at customer selection for restricted cases. Approvers will need to action pending requests via the new tab under Account Activation. Branch procedures and approver responsibilities will need to be communicated prior to go-live.
E2E Validation Required
Yes – End-to-end testing is required across all three workflow scenarios (Not Allowed, Allowed with Approval, Allowed without Approval), the Pending and Rejected tabs, the approval stepper, audit logging, and the downstream account activation and special rate flow.
Diagrams and Examples

Figure  SEQ Figure \* ARABIC 2 – Sample UI – Activate Account Pending Tab (with Current Stage Column)

Figure  SEQ Figure \* ARABIC 3 - Sample UI – Pending Other Branch Opening  – Customer Details Stepper
                                                          
 

Figure  SEQ Figure \* ARABIC 4- Sample UI – Pending Other Branch Opening- Product Details Stepper

Figure  SEQ Figure \* ARABIC 5 - Sample UI – Pending Other Branch Opening - Account Details Stepper- Basic Account Details

Figure  SEQ Figure \* ARABIC 6 - Sample UI – Pending Other Branch Opening – Account Details Stepper – Control & Restrictions

Figure  SEQ Figure \* ARABIC 7 - Sample UI- Pending Other Branch Opening – Account Details Stepper – Account Purpose 

Figure  SEQ Figure \* ARABIC 8 - Sample UI- Pending Other Branch Opening – Account Details Stepper – Source of Funds

Figure  SEQ Figure \* ARABIC 9- Sample UI - Pending Other Branch Opening -Confirmation Screen

Figure  SEQ Figure \* ARABIC 10 - Sample UI - Other Branch Approval Rejected Tab

Annexure 

https://lolcgroupdev.atlassian.net/browse/PF-15810 

