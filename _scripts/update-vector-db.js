require('dotenv').config();
const { OpenAIEmbeddings } = require('@langchain/openai');
const supabase = require('../config/supabase');
const { Pinecone: PineconeClient } = require('@pinecone-database/pinecone');

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
});
const pinecone = new PineconeClient();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_TWO);

async function updateVectorStore() {
  try {
    // Get last message ID from vector_db table
    const { data: lastMessageIdFromDb, error: lastMessageIdError } =
      await supabase.from('vector_db').select('last_message_id').eq('id', 1);

    if (lastMessageIdError) throw lastMessageIdError;

    const lastMessageId = lastMessageIdFromDb[0].last_message_id || 0;

    // Get messages from supabase
    const { data: messages, error } = await supabase
      .from('messages')
      .select(
        `
        *,
        conversations (
          *,
          conversation_members (user_id)
        )
      `
      )
      .order('created_at', { ascending: true })
      .gt('id', lastMessageId);

    if (error) throw error;

    const messagesWithContent = messages.filter((message) => message.content);
    const messageContentEmbeddings = await embeddings.embedDocuments(
      messagesWithContent.map((message) => message.content)
    );

    const messageVectors = messageContentEmbeddings.map((embedding, index) => {
      const message = messagesWithContent[index];
      return {
        id: message.id.toString(),
        values: embedding,
        metadata: {
          content: message.content,
          messageId: message.id,
          userId: message.created_by,
          conversationId: message.conversation_id,
          conversationName: message.conversations.name,
          conversationMembers: message.conversations.conversation_members
            .map((m) => m.user_id)
            .join(','),
          createdAt: message.created_at,
        },
      };
    });

    await pineconeIndex.upsert(messageVectors);
    console.log(
      `Successfully added ${messagesWithContent.length}/${messages.length} messages to vector store`
    );
    // Get highest message ID
    const highestMessageId = Math.max(...messages.map((msg) => msg.id));

    // Update vector_db table with latest message ID
    const { error: updateError } = await supabase
      .from('vector_db')
      .update({ last_message_id: highestMessageId })
      .eq('id', 1);

    if (updateError) throw updateError;

    console.log(
      `saved the highest message ID to supabase vector_db table: ${highestMessageId}`
    );
  } catch (error) {
    console.error('Error updating vector store:', error);
    throw error;
  }
}

// Execute the update
updateVectorStore();
