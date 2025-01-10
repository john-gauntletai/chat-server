# Database Schema

## Tables and Relationships

### messages

| Column Name     | Data Type   | Description                               |
| --------------- | ----------- | ----------------------------------------- |
| id              | int8        | Primary key                               |
| created_at      | timestamptz | Timestamp when the message was created    |
| created_by      | text        | Creator of the message                    |
| content         | text        | Message content                           |
| conversation_id | int8        | Foreign key linking to `conversations.id` |
| reactions       | jsonb       | JSON object for reactions                 |

### message_replies

| Column Name       | Data Type | Description                          |
| ----------------- | --------- | ------------------------------------ |
| message_id        | int8      | Foreign key linking to `messages.id` |
| parent_message_id | int8      | Foreign key linking to `messages.id` |

### conversations

| Column Name     | Data Type   | Description                                 |
| --------------- | ----------- | ------------------------------------------- |
| id              | int8        | Primary key                                 |
| created_at      | timestamptz | Timestamp when the conversation was created |
| name            | text        | Name of the conversation                    |
| is_conversation | boolean     | Whether the conversation is a conversation  |
| is_public       | boolean     | Whether the conversation is public          |
| created_by      | text        | Creator of the conversation                 |

### conversation_members

| Column Name     | Data Type   | Description                               |
| --------------- | ----------- | ----------------------------------------- |
| created_at      | timestamptz | Timestamp when the member joined          |
| conversation_id | int8        | Foreign key linking to `conversations.id` |
| user_id         | text        | ID of the user in the conversation        |

### user_statuses

| Column Name | Data Type          | Description                        |
| ----------- | ------------------ | ---------------------------------- |
| created_at  | timestamptz        | Timestamp when the member joined   |
| status      | user_status (ENUM) | the presence of the user           |
| user_id     | text               | ID of the user in the conversation |

## Relationships

- `message_replies.message_id` → `messages.id` (One-to-One relationship)
- `message_replies.parent_message_id` → `messages.id` (Many-to-One relationship)
- `messages.conversation_id` → `conversation.id` (Many-to-One relationship)
- `conversation_members.conversation_id` → `conversations.id` (Many-to-One relationship)
  """
