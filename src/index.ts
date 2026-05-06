import express from 'express';
import jobsRouter from './api/jobs';

const app = express();
app.use('/jobs', jobsRouter);
app.use(express.json());

const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
