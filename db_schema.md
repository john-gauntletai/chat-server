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

## Relationships

- `messages.conversation_id` → `cconversation.id` (Many-to-One relationship)
- `conversation_members.conversation_id` → `conversations.id` (Many-to-One relationship)
  """
