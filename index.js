const fastify = require("fastify")({ logger: true });
const path = require("path");

// Enregistrement du plugin fastify-static
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname), // Répertoire contenant vos fichiers statiques
  prefix: "/", // URL de base pour accéder aux fichiers
});

// Route par défaut pour servir index.html
fastify.get("/", (req, reply) => {
  reply.sendFile("index.html"); // Sert le fichier index.html
});

// Démarrage du serveur
const start = async () => {
  try {
    await fastify.listen({ port: 8080 });
    console.log("Serveur en cours d'exécution sur http://localhost:8080");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
