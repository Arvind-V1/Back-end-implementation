-- seed.sql : donnees de test pour l'API Internal Tools
-- A lancer APRES un premier demarrage de l'API (les tables sont creees par TypeORM).
-- ATTENTION : vide les 3 tables avant de les remplir.

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE usage_logs;
TRUNCATE TABLE tools;
TRUNCATE TABLE categories;
SET FOREIGN_KEY_CHECKS = 1;

-- 10 categories (Development = 2, comme dans l'exemple du sujet)
INSERT INTO categories (id, name) VALUES
(1, 'Communication'),
(2, 'Development'),
(3, 'Design'),
(4, 'Sales'),
(5, 'Project Management'),
(6, 'Analytics'),
(7, 'Security'),
(8, 'Marketing'),
(9, 'Human Resources'),
(10, 'Finance');

-- 20 outils (Confluence = id 5, 5.50 x 9 utilisateurs = 49.50, comme dans l'exemple du sujet)
INSERT INTO tools
(id, name, description, vendor, category_id, monthly_cost, owner_department, status, website_url, active_users_count, created_at, updated_at) VALUES
(1,  'Slack',            'Team messaging platform',               'Slack Technologies',        1,  8.00, 'Engineering', 'active',     'https://slack.com',                          25, '2025-05-01 09:00:00', '2025-05-01 09:00:00'),
(2,  'GitHub',           'Code hosting and CI',                   'GitHub Inc.',               2, 21.00, 'Engineering', 'active',     'https://github.com',                         18, '2025-05-01 09:00:00', '2025-05-01 09:00:00'),
(3,  'Figma',            'Design collaboration',                  'Figma Inc.',                3, 15.00, 'Design',      'active',     'https://figma.com',                           8, '2025-05-03 09:00:00', '2025-05-03 09:00:00'),
(4,  'HubSpot',          'CRM and marketing automation',          'HubSpot Inc.',              4, 45.00, 'Sales',       'active',     'https://hubspot.com',                        10, '2025-05-05 09:00:00', '2025-05-05 09:00:00'),
(5,  'Confluence',       'Team collaboration and documentation',  'Atlassian',                 2,  5.50, 'Engineering', 'active',     'https://confluence.atlassian.com',            9, '2025-05-01 09:00:00', '2025-05-01 09:00:00'),
(6,  'Jira',             'Issue tracking',                        'Atlassian',                 5,  7.75, 'Engineering', 'active',     'https://www.atlassian.com/software/jira',    15, '2025-05-01 09:00:00', '2025-05-01 09:00:00'),
(7,  'Notion',           'Docs and wikis',                        'Notion Labs',               5, 10.00, 'Operations',  'active',     'https://notion.so',                          14, '2025-05-10 09:00:00', '2025-05-10 09:00:00'),
(8,  'Zoom',             'Video conferencing',                    'Zoom Video Communications', 1, 13.33, 'Operations',  'active',     'https://zoom.us',                            22, '2025-05-01 09:00:00', '2025-05-01 09:00:00'),
(9,  'Google Workspace', 'Email and office suite',                'Google',                    1, 12.00, 'Operations',  'active',     'https://workspace.google.com',               25, '2025-05-01 09:00:00', '2025-05-01 09:00:00'),
(10, 'Datadog',          'Monitoring and observability',          'Datadog Inc.',              6, 31.00, 'Engineering', 'active',     'https://www.datadoghq.com',                   7, '2025-05-12 09:00:00', '2025-05-12 09:00:00'),
(11, 'Sentry',           'Error tracking',                        'Functional Software',       2, 26.00, 'Engineering', 'active',     'https://sentry.io',                           9, '2025-05-12 09:00:00', '2025-05-12 09:00:00'),
(12, '1Password',        'Password manager',                      'AgileBits',                 7,  7.99, 'Operations',  'active',     'https://1password.com',                      25, '2025-05-02 09:00:00', '2025-05-02 09:00:00'),
(13, 'Salesforce',       'CRM platform',                          'Salesforce Inc.',           4, 75.00, 'Sales',       'active',     'https://www.salesforce.com',                  6, '2025-05-05 09:00:00', '2025-05-05 09:00:00'),
(14, 'Mailchimp',        'Email marketing',                       'Intuit Mailchimp',          8, 20.00, 'Marketing',   'active',     'https://mailchimp.com',                       4, '2025-05-15 09:00:00', '2025-05-15 09:00:00'),
(15, 'Canva',            'Graphic design for non designers',      'Canva Pty',                 3, 12.99, 'Marketing',   'trial',      'https://canva.com',                           5, '2025-06-01 09:00:00', '2025-06-01 09:00:00'),
(16, 'BambooHR',         'HR management',                         'BambooHR LLC',              9,  6.19, 'HR',          'active',     'https://www.bamboohr.com',                    4, '2025-05-20 09:00:00', '2025-05-20 09:00:00'),
(17, 'QuickBooks',       'Accounting software',                   'Intuit',                   10, 30.00, 'Finance',     'active',     'https://quickbooks.intuit.com',               3, '2025-05-20 09:00:00', '2025-05-20 09:00:00'),
(18, 'Trello',           'Kanban boards',                         'Atlassian',                 5, 10.00, 'Operations',  'deprecated', 'https://trello.com',                          3, '2025-05-01 09:00:00', '2025-07-15 09:00:00'),
(19, 'Asana',            'Work management',                       'Asana Inc.',                5, 10.99, 'Marketing',   'deprecated', 'https://asana.com',                           2, '2025-05-01 09:00:00', '2025-07-15 09:00:00'),
(20, 'Miro',             'Online whiteboard',                     'Miro',                      3,  8.00, 'Design',      'trial',      'https://miro.com',                            6, '2025-06-10 09:00:00', '2025-06-10 09:00:00');

-- Historique d'usage sur ~90 jours : 15 sessions par utilisateur actif, reparties
-- sur 25 employes (user_id de 1 a 25), duree de 15 a 74 minutes.
INSERT INTO usage_logs (tool_id, user_id, session_date, duration_minutes)
WITH RECURSIVE n AS (
  SELECT 1 AS i
  UNION ALL
  SELECT i + 1 FROM n WHERE i < 400
)
SELECT
  t.id,
  ((n.i + t.id) % 25) + 1,
  NOW() - INTERVAL ((n.i * 7 + t.id * 3) % 90) DAY - INTERVAL ((n.i * 37) % 600) MINUTE,
  15 + ((n.i * 11 + t.id * 7) % 60)
FROM tools t
JOIN n ON n.i <= t.active_users_count * 15;

-- Verification rapide
SELECT COUNT(*) AS outils FROM tools;
SELECT COUNT(*) AS sessions FROM usage_logs;
